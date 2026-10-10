import type { AgentInspectorSnapshot, ApprovalSnapshot } from '../../core/agent-inspector.service';
import { operationalResults, presentOperationalResult, type OperationalResult } from '../operational-overview/operational-result.presenter';
import { operationalCopy, evidenceCopy, type EvidenceCopyKey } from './evidence-copy';

export type EvidenceVerificationState='VERIFIED'|'PARTIALLY_VERIFIED'|'NEEDS_CONFIRMATION'|'NO_MATCHING_RECORDS'|'EVIDENCE_UNAVAILABLE'|'HUMAN_DECISION_REQUIRED';
export type EvidenceAction={label:string;route:string}|{label:string;url:string}|{label:string;approvalTarget:string};
export interface EvidenceItem {label:string;value?:string;passage?:string;jurisdiction?:string;version?:string;source?:string;action?:EvidenceAction;}
export interface EvidenceViewModel {
  kind?:'knowledge';
  title:string;verificationState:EvidenceVerificationState;verificationLabel:string;conclusion:string;explanation:string;
  sourceLabel:string;scopeLabel?:string;jurisdiction?:string;evidenceItems:EvidenceItem[];checkedAt?:string;
  available:string[];missing:string[];nextStep?:string;sourceAction?:EvidenceAction;nextAction?:EvidenceAction;
}
export interface EvidencePresentation {
  operational:Array<{source:string;scope?:string;checkedAt:string;items:Array<{identifier:string;status?:string}>}>;
  documents:Array<{title:string;citation:string;passage:string;organization?:string;jurisdiction?:string;version?:string;url?:string}>;
}
export type EvidenceSnapshot=AgentInspectorSnapshot & {evidencePresentation?:EvidencePresentation};

/** Never use technical traces, raw JSON or opaque IDs as a business-text fallback. */
export function businessText(value:unknown,limit=1600):string|undefined {
  if(typeof value!=='string' || /SUCCESS_WITH_DATA|SUCCESS_NO_DATA|\bCOMPLETED\b|Filters:|recordCount|\bRRF\b|embedding|chunkId|runId|vector score|retrieval config|tool JSON|[{}]/i.test(value))return undefined;
  const text=value.replace(/<[^>]*>/g,'').trim();return text ? text.slice(0,limit) : undefined;
}
function sourceUrl(value:unknown):string|undefined {
  if(typeof value!=='string')return undefined;
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password ? url.href : undefined;}catch{return undefined;}
}
function scopeText(value:unknown):string|undefined {const text=businessText(value,160);return text && !/^(?:\*|unknown|unspecified|n\/a)$/i.test(text)?text:undefined;}
/** Display only bounded prose, never serialize metadata or cut off a qualification. */
function knowledgeText(value:unknown,limit:number):string|undefined {
  if(typeof value!=='string' || /source[_-]?id|document[_-]?id|chunk[_-]?id|content[_-]?state|retrieved[_-]?at|embedding|\bRRF\b|vector[_\s-]?scores?|ingestion|metadata|https?:\/\/|www\.|[{}]|\[[\s\d,"\]]*\]/i.test(value))return undefined;
  const text=businessText(value,Number.MAX_SAFE_INTEGER);
  return text && text.length<=limit && !/(?:…|\.{3})$/.test(text) ? text : undefined;
}
function knowledgeMetadata(value:unknown,limit:number):string|undefined {
  const text=knowledgeText(value,limit);
  return text && !/^(?:\*|unknown|unspecified|n\/a|null|undefined|none)$/i.test(text)?text:undefined;
}
function state(snapshot:EvidenceSnapshot,result?:OperationalResult,zero=false):EvidenceVerificationState {
  if(result?.status==='ERROR')return 'EVIDENCE_UNAVAILABLE';
  if(result && result.status!=='COMPLETED')return 'NEEDS_CONFIRMATION';
  const verification=snapshot.executionTrace?.verification?.status;
  if(verification==='PARTIALLY_VERIFIED')return 'PARTIALLY_VERIFIED';
  if(verification==='INSUFFICIENT_EVIDENCE')return 'EVIDENCE_UNAVAILABLE';
  if(verification==='CONTRADICTED'||verification==='SAFETY_BLOCKED')return 'NEEDS_CONFIRMATION';
  if(zero && result?.status==='COMPLETED')return 'NO_MATCHING_RECORDS';
  return verification==='VERIFIED' ? 'VERIFIED' : 'NEEDS_CONFIRMATION';
}
function stateLabel(value:EvidenceVerificationState,language:string):string {
  if(value==='HUMAN_DECISION_REQUIRED')return evidenceCopy('decision',language);
  return operationalCopy(({VERIFIED:'verified',PARTIALLY_VERIFIED:'partial',NEEDS_CONFIRMATION:'confirmation',NO_MATCHING_RECORDS:'noRecords',EVIDENCE_UNAVAILABLE:'evidenceUnavailable'} as const)[value],language);
}
function support(snapshot:EvidenceSnapshot,verification:EvidenceVerificationState,language:string) {
  const available=operationalResults(snapshot).filter(t=>t.status==='COMPLETED').map(t=>presentOperationalResult(t,undefined,language).title);
  if(snapshot.evidencePresentation?.documents.length || snapshot.citations?.length)available.push(evidenceCopy('approved',language));
  const partial=verification==='PARTIALLY_VERIFIED'||verification==='NEEDS_CONFIRMATION'||verification==='EVIDENCE_UNAVAILABLE';
  const missingSources=operationalResults(snapshot).some(t=>t.status==='ERROR') || ['RETRIEVAL_UNAVAILABLE','PARTIAL_REQUIRED_EVIDENCE','NO_RELEVANT_EVIDENCE'].includes(snapshot.executionTrace?.rag.status??'');
  return {available:[...new Set(available)],missing:partial ? [evidenceCopy(missingSources?'missingSources':'missingSupport',language),evidenceCopy('missingDetails',language)] : []};
}
function emptyModel(title:string,verificationState:EvidenceVerificationState,language:string):EvidenceViewModel {
  return {title,verificationState,verificationLabel:stateLabel(verificationState,language),conclusion:operationalCopy('confirmation',language),explanation:evidenceCopy('noEvidence',language),sourceLabel:operationalCopy('generic',language),evidenceItems:[],available:[],missing:[]};
}
const statuses:Record<string,EvidenceCopyKey>={open:'open',pending:'pending',closed:'closed','in progress':'inProgress','in-progress':'inProgress'};
export function presentOperationalEvidence(result:OperationalResult,snapshot:EvidenceSnapshot,language='en',occurrence=0):EvidenceViewModel {
  const card=presentOperationalResult(result,snapshot.executionTrace?.verification?.status,language);
  const zero=result.status==='COMPLETED' && (result.resultStatus==='SUCCESS_NO_DATA'||card.primaryValue==='0');
  const verification=state(snapshot,result,zero),model=emptyModel(`${operationalCopy('supporting',language)} — ${card.title}`,verification,language);
  model.conclusion=card.primaryValue ? `${card.title}: ${card.primaryValue} ${card.businessStatus}` : card.summary;
  model.explanation=zero ? `${card.summary} ${evidenceCopy('successfulZero',language)}` : card.summary;
  model.sourceLabel=result.name==='list_actions'?evidenceCopy('actionsRegister',language):result.name==='list_incidents'?evidenceCopy('incidentsRegister',language):card.title;
  const details=result.status==='COMPLETED' ? snapshot.evidencePresentation?.operational.filter(item=>item.source===result.name)[occurrence] : undefined;
  model.scopeLabel=scopeText(details?.scope);
  if(result.status==='COMPLETED') {
    const timestamp=details?.checkedAt ?? snapshot.executionTrace?.timestamp;
    if(timestamp && Number.isFinite(Date.parse(timestamp)))model.checkedAt=timestamp;
    model.evidenceItems=[{label:card.title,value:[card.primaryValue,card.businessStatus].filter(Boolean).join(' ')},...card.metrics.map(metric=>({label:metric.label,value:metric.value})),
      ...(details?.items??[]).flatMap(item=>{const id=businessText(item.identifier,80);return id?[{label:id,value:statuses[item.status?.toLowerCase()??''] ? evidenceCopy(statuses[item.status!.toLowerCase()],language) : undefined}]:[]})];
  }
  const context=support(snapshot,verification,language);Object.assign(model,context);
  if(context.missing.length){model.explanation+=` ${evidenceCopy('partialWhy',language)}`;model.nextStep=evidenceCopy('review',language);}
  const action=card.actions[0];if(action)model.sourceAction={label:operationalCopy('details',language),route:action.route};
  return model;
}

export function presentResponseEvidence(snapshot:EvidenceSnapshot,conclusion:string,language='en',approval?:ApprovalSnapshot,approvalTarget?:string):EvidenceViewModel[] {
  const result:EvidenceViewModel[]=[];
  const documents=snapshot.evidencePresentation?.documents ?? [];
  if(snapshot.ragUsed || documents.length || snapshot.citations?.length) {
    const verification=state(snapshot),model=emptyModel(operationalCopy('supporting',language),verification,language);
    model.kind='knowledge';
    model.conclusion=knowledgeText(conclusion,600)??evidenceCopy('seeAnswer',language);
    model.sourceLabel=evidenceCopy('approved',language);model.explanation=evidenceCopy('ragExplanation',language);
    const sources=documents.length ? documents : (snapshot.citations??[]).map(c=>({title:c.citationLabel,citation:c.citationLabel,passage:'',jurisdiction:c.jurisdiction,url:c.sourceUrl,organization:undefined,version:undefined}));
    model.evidenceItems=sources.slice(0,8).map(doc=>{
      const url=sourceUrl(doc.url);
      return {label:knowledgeText(doc.title,200)??evidenceCopy('approvedSource',language),
        passage:knowledgeText(doc.passage,700)??evidenceCopy(doc.passage?'passageContext':'noPassage',language),jurisdiction:knowledgeMetadata(doc.jurisdiction,160),version:knowledgeMetadata(doc.version,80),
        action:url?{label:evidenceCopy('viewSource',language),url}:undefined};
    });
    Object.assign(model,support(snapshot,verification,language));
    if(model.missing.length){model.explanation+=` ${evidenceCopy('partialWhy',language)}`;model.nextStep=evidenceCopy('review',language);}
    if(!model.evidenceItems.length){model.verificationState='EVIDENCE_UNAVAILABLE';model.verificationLabel=stateLabel(model.verificationState,language);model.explanation=evidenceCopy('noEvidence',language);}
    result.push(model);
  }
  const decision=approval?.approvalId===snapshot.approvalRequest?.approvalId && approval?.threadId===snapshot.approvalRequest?.threadId ? approval : snapshot.approvalRequest;
  if(decision) {
    const pending=decision.status==='PENDING',model=emptyModel(evidenceCopy('decisionBasis',language),pending?'HUMAN_DECISION_REQUIRED':'NEEDS_CONFIRMATION',language);
    model.conclusion=evidenceCopy(pending?'decision':decision.status==='APPROVED'?'approvedDecision':decision.status==='REJECTED'?'rejectedDecision':'cancelledDecision',language);
    model.explanation=evidenceCopy(decision.actionType==='LOTO_SAFETY_EXECUTION'?'physical':'humanReason',language);
    model.sourceLabel=evidenceCopy('decisionBasis',language);model.available=support(snapshot,model.verificationState,language).available;
    model.evidenceItems=[{label:evidenceCopy('available',language),value:evidenceCopy('canVerify',language)}];
    model.missing=[model.explanation];model.nextStep=evidenceCopy(pending?'humanNext':'review',language);
    if(approvalTarget)model.nextAction={label:evidenceCopy('viewApproval',language),approvalTarget};
    result.push(model);
  }
  if(!result.length && !operationalResults(snapshot).length && snapshot.executionTrace?.verification) {
    const verification=state(snapshot),model=emptyModel(operationalCopy('supporting',language),verification==='VERIFIED'?'NEEDS_CONFIRMATION':verification,language);
    model.conclusion=businessText(conclusion)??operationalCopy('confirmation',language);Object.assign(model,support(snapshot,model.verificationState,language));model.nextStep=evidenceCopy('review',language);result.push(model);
  }
  return result;
}
