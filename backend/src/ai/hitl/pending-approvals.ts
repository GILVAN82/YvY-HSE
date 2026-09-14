import { randomUUID } from 'node:crypto';
import type { RequestPrincipal } from '../../auth/auth.types';
import { AuthorizationError, assertPermission, assertProjectAccess } from '../../auth/authorization';
import type { ApprovalService } from './hitl.types';
import { attentionMessages, safeAttentionLabel, type AttentionFacts } from '../attention/attention-explanation';
import { classifyIntent } from '../intent/intentRouter';
import type { AgentRunResult } from '../graph/hseAgent.types';

const copy={
 en:{one:'1 approval is awaiting your decision.',many:(n:number)=>`${n} approvals are awaiting your decision.`,zero:'No approvals are currently waiting for your decision.'},
 pt:{one:'1 aprovação aguarda sua decisão.',many:(n:number)=>`${n} aprovações aguardam sua decisão.`,zero:'Nenhuma aprovação aguarda sua decisão no momento.'},
 es:{one:'1 aprobación espera su decisión.',many:(n:number)=>`${n} aprobaciones esperan su decisión.`,zero:'Ninguna aprobación espera su decisión actualmente.'},
 fr:{one:'1 approbation attend votre décision.',many:(n:number)=>`${n} approbations attendent votre décision.`,zero:'Aucune approbation n’attend votre décision actuellement.'},
 de:{one:'1 Genehmigung wartet auf Ihre Entscheidung.',many:(n:number)=>`${n} Genehmigungen warten auf Ihre Entscheidung.`,zero:'Derzeit wartet keine Genehmigung auf Ihre Entscheidung.'},
};
/** Canonical read-only tool. Technical references are separate from business facts. */
export async function listPendingApprovals(principal:RequestPrincipal,service:ApprovalService,project?:string){
 assertPermission(principal,'AI_USE','approval','read');assertPermission(principal,'HSE_DATA_READ','approval','read');
 if(project)assertProjectAccess(principal,project);
 const scoped=service.forPrincipal?.(principal)??service;
 if(!scoped.listPending)throw new Error('APPROVAL_SOURCE_UNAVAILABLE');
 const approvals=await scoped.listPending(project);
 return approvals.filter(a=>a.status==='PENDING').map(approval=>({approval,facts:{
   basisSource:'APPROVAL_REGISTER',category:'PENDING_APPROVAL',sourceType:'HITL',approvalActionType:approval.actionType,severity:approval.riskLevel,
   status:approval.status,decisionRequired:true,projectLabel:safeAttentionLabel(approval.scopeProjects?.join(', ')),checkedAt:new Date().toISOString(),
 } satisfies AttentionFacts}));
}

/** Navigation filters are untrusted hints. The repository must authorize the value again. */
export function pendingApprovalProject(explicit:string|undefined,pageContext:string|undefined,message:string):string|undefined{
 if(explicit)return explicit;
 const textual=message.match(/\b(?:for(?: project)?|in project|no projeto|do projeto|para o projeto)\s+([\w-]+)/i)?.[1];
 if(textual)return textual;
 if(!pageContext)return undefined;
 try{const data=JSON.parse(pageContext.trim().split('\n').at(-1)??'');const project=data?.filters?.project;return typeof project==='string'&&project.trim()&&project!=='*'?project.trim():undefined;}catch{return undefined;}
}

export async function pendingApprovalsResponse(input:{principal:RequestPrincipal;service:ApprovalService;message:string;threadId:string;locale?:string;project?:string}){
 const language=(input.locale??'en') as keyof typeof copy,c=copy[language]??copy.en;
 const items=await listPendingApprovals(input.principal,input.service,input.project),count=items.length,timestamp=new Date().toISOString();
 const result:AgentRunResult&{pendingApprovals:typeof items}={
  runId:randomUUID(),conversationId:input.threadId,status:'COMPLETED',text:count===0?c.zero:count===1?c.one:c.many(count),
  toolsUsed:['list_pending_approvals'],stepCount:1,ragUsed:false,citations:[],pendingApprovals:items,
  approvalRequest:items[0]?.approval,
  executionTrace:{timestamp,responseLanguage:language,route:['guard','list_pending_approvals','verify','respond'],
   intent:{...classifyIntent(input.message),selectedTool:'list_pending_approvals'},
   tools:[{name:'list_pending_approvals',status:'COMPLETED',arguments:{scope:input.project??'Authorized projects'},resultStatus:count?'SUCCESS_WITH_DATA':'SUCCESS_NO_DATA',resultSummary:`${count} pending approval(s)`}],
   rag:{used:false,status:'NOT_APPROPRIATE',chunksRetrieved:0},conversation:{stateActive:false,messageCount:0},memory:{used:false,operation:'NONE',categories:[],status:'NOT_USED'},guardrail:{status:'PASS'},
   verification:{status:'VERIFIED',claimsConsidered:count+1,verifiedClaims:count+1,unsupportedClaims:0,evidenceItemsConsidered:count+1,evidenceSourceTypes:['TOOL'],sources:['list_pending_approvals'],reasons:['CURRENT_APPROVAL_STATE_VERIFIED','PHYSICAL_STATE_NOT_ASSERTED']}}
 };
 return result;
}

export function pendingApprovalError(error:unknown,locale='en'){
 const code=error instanceof AuthorizationError?error.code:'APPROVAL_SOURCE_UNAVAILABLE';
 const messages:Record<string,Record<string,string>>={
 en:{AUTHORIZATION_DENIED:'You are not authorized to view approvals.',PROJECT_SCOPE_DENIED:'The selected project is outside your authorized scope.',RESOURCE_NOT_FOUND:'This approval no longer exists.',APPROVAL_SOURCE_UNAVAILABLE:'Pending approvals are temporarily unavailable. Please try again.'},
 pt:{AUTHORIZATION_DENIED:'Você não tem permissão para consultar aprovações.',PROJECT_SCOPE_DENIED:'O projeto selecionado está fora do seu escopo autorizado.',RESOURCE_NOT_FOUND:'Esta aprovação não existe mais.',APPROVAL_SOURCE_UNAVAILABLE:'As aprovações pendentes estão temporariamente indisponíveis. Tente novamente.'},
 es:{AUTHORIZATION_DENIED:'No tiene permiso para consultar aprobaciones.',PROJECT_SCOPE_DENIED:'El proyecto seleccionado está fuera de su ámbito autorizado.',RESOURCE_NOT_FOUND:'Esta aprobación ya no existe.',APPROVAL_SOURCE_UNAVAILABLE:'Las aprobaciones pendientes no están disponibles temporalmente.'},
 fr:{AUTHORIZATION_DENIED:'Vous n’êtes pas autorisé à consulter les approbations.',PROJECT_SCOPE_DENIED:'Le projet sélectionné est hors de votre périmètre autorisé.',RESOURCE_NOT_FOUND:'Cette approbation n’existe plus.',APPROVAL_SOURCE_UNAVAILABLE:'Les approbations en attente sont temporairement indisponibles.'},
 de:{AUTHORIZATION_DENIED:'Sie dürfen keine Genehmigungen einsehen.',PROJECT_SCOPE_DENIED:'Das ausgewählte Projekt liegt außerhalb Ihres Berechtigungsbereichs.',RESOURCE_NOT_FOUND:'Diese Genehmigung existiert nicht mehr.',APPROVAL_SOURCE_UNAVAILABLE:'Ausstehende Genehmigungen sind vorübergehend nicht verfügbar.'},
 };
 return {code,error:(messages[locale]??messages.en)[code]??(attentionMessages[locale as keyof typeof attentionMessages]??attentionMessages.en).denied};
}
