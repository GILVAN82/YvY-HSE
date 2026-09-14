import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { RequestPrincipal } from '../../auth/auth.types';
import { assertPermission, assertProjectAccess } from '../../auth/authorization';
import { alertAccessSql } from '../alerts/alert-access';
import type { ApprovalService, ApprovalRequest } from '../hitl/hitl.types';
import type { RagRetriever, RagRetrievalResult } from '../rag/retrieval.types';
import type { AgentRunResult } from '../graph/hseAgent.types';
import { buildEvidencePresentation } from '../graph/evidencePresentation';
import { ACTION_OVERDUE_SQL } from '../../domain/actions';

export interface AttentionFacts {
  basisSource?:'APPROVAL_REGISTER';
  summary?:string; approvalActionType?:string; category:string; severity:string; status:string; projectLabel?:string;
  sourceType:string; decisionRequired:boolean; checkedAt:string;
}
export interface AuthorizedAttention { facts:AttentionFacts; approval?:ApprovalRequest }
export interface AttentionReader { get(principal:RequestPrincipal,id:string):Promise<AuthorizedAttention|null> }
/** One read-only query with live ownership/project checks; never consume client facts. */
export class PostgresAttentionReader implements AttentionReader {
  constructor(private db:Pick<Pool,'query'>,private approvals:ApprovalService){}
  async get(principal:RequestPrincipal,id:string):Promise<AuthorizedAttention|null>{
    assertPermission(principal,'HSE_DATA_READ','attention','read');
    const result=await this.db.query(`SELECT a.category,a.severity,a.status,a.source_type,a.source_id,
      ha.status approval_status,ha.scope_projects,
      (SELECT min(src.project) FROM action_tracker_capa src WHERE src.action_id=a.source_id) action_project,
      (SELECT min(src.action_description) FROM action_tracker_capa src WHERE src.action_id=a.source_id) action_description,
      (SELECT bool_or(${ACTION_OVERDUE_SQL}) FROM action_tracker_capa src WHERE src.action_id=a.source_id) action_overdue,
      (SELECT min(src.status) FROM action_tracker_capa src WHERE src.action_id=a.source_id) action_status
      FROM yvy_proactive_alert a LEFT JOIN agent_human_approval ha ON a.source_type='HITL' AND ha.id::text=a.source_id
      WHERE a.id=$1 AND a.user_id=$2 AND ${alertAccessSql('a')}`,[id,principal.userId]);
    const row=result.rows[0];if(!row)return null;
    let approval:ApprovalRequest|undefined;
    if(row.source_type==='HITL'){
      approval=await (this.approvals.forPrincipal?.(principal)??this.approvals).get(row.source_id)??undefined;
      if(!approval)return null;
    }
    const projects=approval?row.scope_projects:[row.action_project];if(!projects?.length||projects.some((project:any)=>typeof project!=='string'||!project))return null;
    for(const project of projects)assertProjectAccess(principal,project);
    const status=approval?.status??(row.category==='OVERDUE_ACTION'&&row.action_overdue===false?'RESOLVED':row.status);
    return {facts:{summary:row.source_type==='OPERATIONAL_DATA'?safeAttentionSummary(row.action_description):undefined,approvalActionType:approval?.actionType,category:row.category,severity:row.severity,status,sourceType:row.source_type,
      projectLabel:approval?row.scope_projects?.join(', '):row.action_project,
      decisionRequired:approval?.status==='PENDING',checkedAt:new Date().toISOString()},approval};
  }
}
export const attentionMessages={
  en:{denied:"I can't access the details of this alert in your current scope. It may have been resolved or your access may have changed.",loto:'LOTO approval',action:'Overdue action',generic:'Operational attention item',pending:'Awaiting human decision',approved:'Approved decision (historical)',rejected:'Rejected decision (historical)',resolved:'Resolved',acknowledged:'Acknowledged',active:'Needs review',physical:'I cannot verify physical isolation or field conditions, or authorize the work.',missing:'I can confirm the alert and its current status, but the approved supporting guidance is unavailable right now.',guidance:'Approved supporting guidance is available in the decision basis.'},
  pt:{denied:'Não consigo acessar este alerta no seu escopo atual. Ele pode ter sido resolvido ou seu acesso pode ter mudado.',loto:'Aprovação LOTO',action:'Ação atrasada',generic:'Item de atenção operacional',pending:'Aguardando decisão humana',approved:'Decisão aprovada (histórico)',rejected:'Decisão rejeitada (histórico)',resolved:'Resolvido',acknowledged:'Reconhecido',active:'Requer revisão',physical:'Não posso verificar o isolamento físico ou as condições no local, nem autorizar o trabalho.',missing:'Posso confirmar o alerta e seu estado atual, mas a orientação aprovada de apoio está indisponível no momento.',guidance:'A orientação aprovada está disponível na base da decisão.'},
  es:{denied:'No puedo acceder a este aviso en su ámbito actual. Puede haberse resuelto o su acceso puede haber cambiado.',loto:'Aprobación LOTO',action:'Acción vencida',generic:'Elemento de atención operativa',pending:'Esperando decisión humana',approved:'Decisión aprobada (histórica)',rejected:'Decisión rechazada (histórica)',resolved:'Resuelto',acknowledged:'Reconocido',active:'Requiere revisión',physical:'No puedo verificar el aislamiento físico ni las condiciones del lugar, ni autorizar el trabajo.',missing:'Puedo confirmar el aviso y su estado actual, pero la orientación aprobada de apoyo no está disponible ahora.',guidance:'La orientación aprobada está disponible en la base de la decisión.'},
  fr:{denied:"Je ne peux pas accéder à cette alerte dans votre périmètre actuel. Elle peut avoir été résolue ou vos accès peuvent avoir changé.",loto:'Approbation LOTO',action:'Action en retard',generic:"Point d’attention opérationnelle",pending:'En attente de décision humaine',approved:'Décision approuvée (historique)',rejected:'Décision rejetée (historique)',resolved:'Résolu',acknowledged:'Pris en compte',active:'À examiner',physical:'Je ne peux pas vérifier l’isolement physique ou les conditions sur site, ni autoriser le travail.',missing:'Je peux confirmer l’alerte et son état actuel, mais les consignes approuvées sont indisponibles pour le moment.',guidance:'Les consignes approuvées sont disponibles dans les éléments de décision.'},
  de:{denied:'Ich kann auf diesen Hinweis in Ihrem aktuellen Bereich nicht zugreifen. Er wurde möglicherweise erledigt oder Ihre Berechtigung hat sich geändert.',loto:'LOTO-Genehmigung',action:'Überfällige Maßnahme',generic:'Operativer Prüfpunkt',pending:'Menschliche Entscheidung ausstehend',approved:'Genehmigte Entscheidung (historisch)',rejected:'Abgelehnte Entscheidung (historisch)',resolved:'Erledigt',acknowledged:'Zur Kenntnis genommen',active:'Prüfung erforderlich',physical:'Ich kann die physische Isolierung oder die Bedingungen vor Ort nicht bestätigen und keine Arbeit genehmigen.',missing:'Ich kann den Hinweis und seinen aktuellen Status bestätigen, aber die freigegebenen unterstützenden Leitlinien sind derzeit nicht verfügbar.',guidance:'Freigegebene Leitlinien sind in der Entscheidungsgrundlage verfügbar.'},
};
export function safeAttentionSummary(value:unknown){return typeof value==='string'&&value.length<=400&&!/[{}]|[a-f0-9]{8}-[a-f0-9-]{27,}|recordCount|SUCCESS_WITH_DATA|Filters|https?:\/\//i.test(value)?value.replace(/<[^>]*>/g,'').trim():undefined;}
export function safeAttentionLabel(value:unknown){return typeof value==='string'&&!/[{}]|[a-f0-9]{8}-[a-f0-9-]{27,}|recordCount|SUCCESS_WITH_DATA|Filters/i.test(value)?value.slice(0,160):undefined;}
/** Deterministic explanation of repository facts. No model-authored safety claim is accepted. */
export async function explainAttention(input:{principal:RequestPrincipal;alertId:string;threadId:string;locale?:string;reader:AttentionReader;rag?:RagRetriever}):Promise<AgentRunResult&{attention?:AttentionFacts}>{
  const lang=(input.locale?.slice(0,2)??'en') as keyof typeof attentionMessages,c=attentionMessages[lang]??attentionMessages.en;
  let found:AuthorizedAttention|null=null;try{found=await input.reader.get(input.principal,input.alertId);}catch{/* Uniform inaccessible response discloses no resource existence. */}
  let rag:RagRetrievalResult={status:'NOT_APPROPRIATE',evidence:[] ,reason:'STRUCTURED_OPERATIONAL_QUERY'};
  const loto=found?.approval?.actionType==='LOTO_SAFETY_EXECUTION';
  if(loto){try{rag=await input.rag?.retrieve('LOTO lockout tagout energy control approved guidance')??{status:'RETRIEVAL_UNAVAILABLE',evidence:[]};}catch{rag={status:'RETRIEVAL_UNAVAILABLE',evidence:[]};}}
  const facts=found?.facts,docs=rag.status==='OK'?rag.evidence:[],status=facts?.status;
  const businessStatus=status==='PENDING'?c.pending:status==='APPROVED'?c.approved:status==='REJECTED'?c.rejected:['RESOLVED','CANCELLED'].includes(status??'')?c.resolved:status==='ACKNOWLEDGED'?c.acknowledged:c.active;
  const text=facts?`${loto?c.loto:facts.category==='OVERDUE_ACTION'?c.action:c.generic}${safeAttentionLabel(facts.projectLabel)?' — '+safeAttentionLabel(facts.projectLabel):''}: ${businessStatus}. ${safeAttentionSummary(facts.summary)?safeAttentionSummary(facts.summary)+' ':''}${loto?(docs.length?c.guidance:c.missing)+' '+c.physical:''}`.trim():c.denied;
  const verification= !facts?'INSUFFICIENT_EVIDENCE':loto&&!docs.length?'PARTIALLY_VERIFIED':'VERIFIED';
  const timestamp=new Date().toISOString();
  return {runId:randomUUID(),conversationId:input.threadId,status:'COMPLETED',text,toolsUsed:['get_attention_alert',...(loto?['search_hse_knowledge']:[])],stepCount:1,
    attention:facts?{...facts,projectLabel:safeAttentionLabel(facts.projectLabel)}:undefined,approvalRequest:found?.approval,
    ragUsed:docs.length>0,citations:docs.map(({sourceId,citationLabel,sourceUrl,jurisdiction})=>({sourceId,citationLabel,sourceUrl,jurisdiction})),
    evidencePresentation:buildEvidencePresentation([],[],docs,timestamp),
    executionTrace:{intent:{input:'Explain this attention item',normalizedQuery:'explain attention item',scope:'IN_SCOPE',confidence:'HIGH',intent:'EXPLAIN_ALERT',candidateTools:['get_attention_alert'],selectedTool:'get_attention_alert',clarificationRequired:false},timestamp,responseLanguage:lang in attentionMessages?lang:'en',route:['guard','get_attention_alert',...(loto?['search_hse_knowledge']:[]),'verify','respond'],
      tools:[{name:'get_attention_alert',status:facts?'COMPLETED':'ERROR',arguments:{alertId:input.alertId},resultSummary:facts?'Authorized current alert facts':'Alert unavailable in current scope'}],
      rag:{used:docs.length>0,status:rag.status,chunksRetrieved:docs.length,diagnostics:rag.diagnostics},
      conversation:{stateActive:false,messageCount:0},memory:{used:false,operation:'NONE',categories:[],status:'NOT_USED'},guardrail:{status:found?'PASS':'BLOCKED'},
      verification:{status:verification,claimsConsidered:facts?2:0,verifiedClaims:facts?2:0,unsupportedClaims:0,evidenceItemsConsidered:(facts?1:0)+docs.length,evidenceSourceTypes:docs.length?['TOOL','RAG']:facts?['TOOL']:[],sources:facts?['get_attention_alert']:[],reasons:found?(loto?['OPERATIONAL_STATUS_VERIFIED','PHYSICAL_STATE_NOT_ASSERTED',...(docs.length?[]:['SUPPORTING_KNOWLEDGE_UNAVAILABLE'])]:['OPERATIONAL_STATUS_VERIFIED']):['ALERT_INACCESSIBLE']}}
  };
}
