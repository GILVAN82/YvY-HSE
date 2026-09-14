import type { AgentInspectorSnapshot, AgentToolTrace } from '../../core/agent-inspector.service';
import { operationalCopy, operationalLanguage, type OperationalCopyKey } from './operational-copy';

export interface OperationalFacts {
  recordCount?: number; pendingCount?: number; openCount?: number; totalCount?: number;
  countIsLowerBound?: boolean;
  metrics?: { trir?: number; ltifr?: number; daysSinceLTI?: number };
}
export type OperationalResult = AgentToolTrace & { presentationFacts?: OperationalFacts };
export type EvidenceState = 'verified' | 'partial' | 'confirmation' | 'unavailable';
export interface OperationalOverviewViewModel {
  title: string; primaryValue: string; businessStatus: string; summary: string;
  evidenceLabel: string; evidenceState: EvidenceState; evidenceSummary: string;
  metrics: Array<{ label: string; value: string }>;
  actions: Array<{ label: string; route: string }>;
}
type Domain = { title: OperationalCopyKey; route?: string; present?: (facts: OperationalFacts, t: Copy, number: (n: number) => string) => Partial<OperationalOverviewViewModel> };
type Copy = (key: OperationalCopyKey) => string;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function counted(n: number | undefined, status: 'pending' | 'open' | 'matching', empty: OperationalCopyKey, facts: OperationalFacts, t: Copy, number: (n: number) => string): Partial<OperationalOverviewViewModel> {
  if (!count(n)) return {};
  return { primaryValue: `${facts.countIsLowerBound ? t('atLeast') + ' ' : ''}${number(n)}`, businessStatus: t(status), summary: n === 0 ? t(empty) : t('retrieved') };
}
/** New domains register here; all renderers consume the same view model. */
const domains: Readonly<Record<string, Domain>> = {
  list_actions: { title:'actions', route:'/sheet/Action Tracker (CAPA)', present:(f,t,n)=>counted(f.pendingCount,'pending','noPending',f,t,n) },
  list_incidents: { title:'incidents', route:'/sheet/Incident Register', present:(f,t,n)=>counted(f.openCount,'open','noOpen',f,t,n) },
  get_projects: { title:'projects', route:'/projects', present:(f,t,n)=>counted(f.recordCount,'matching','noRecords',f,t,n) },
  get_kpi: { title:'kpi', route:'/portfolio', present:(f,t)=> {
    const metrics = ([['trir','TRIR'],['ltifr','LTIFR'],['daysSinceLTI',t('days')]] as const)
      .flatMap(([key,label])=> { const value=f.metrics?.[key]; return typeof value==='number' && Number.isFinite(value) && value>=0 ? [{label,value: key==='daysSinceLTI' ? String(value) : value.toFixed(2)}] : []; });
    return metrics.length ? { primaryValue:metrics[0].value, businessStatus:metrics[0].label, metrics } : {};
  } },
};
const nonOperational = new Set(['search_hse_knowledge','save_memory','forget_memory','prepare_record_draft','list_app_modules']);
export function operationalResults(snapshot?: AgentInspectorSnapshot): OperationalResult[] {
  return (snapshot?.executionTrace?.tools ?? []).filter(tool=>!nonOperational.has(tool.name) &&
    (!!domains[tool.name] || tool.name==='query_app_records' || snapshot?.executionTrace?.intent?.intent==='OPERATIONAL_OVERVIEW' || !!(tool as OperationalResult).presentationFacts));
}

/** Old saved results lack numeric facts. Parse only known, whole count formats; never render raw text. */
function legacyFacts(result: OperationalResult): OperationalFacts {
  const text=result.resultSummary ?? '';
  const facts: OperationalFacts = {};
  if (result.name==='list_actions') {
    const match=/^(\d+) (?:pending actions?|ações pendentes|ação pendente|acciones pendientes|acción pendiente|actions? en attente|offene Maßnahmen?)$/i.exec(text);
    if(match) facts.pendingCount=Number(match[1]);
  }
  if(result.name==='list_incidents') {
    const match=/^\d+ (?:total incidents; (\d+) open|incidentes no total; (\d+) em aberto)$/.exec(text);
    if(match) facts.openCount=Number(match[1]??match[2]);
  }
  return facts;
}

export function presentOperationalResult(result: OperationalResult, verification: string | undefined, language = 'en'): OperationalOverviewViewModel {
  const locale=operationalLanguage(language), t:Copy=key=>operationalCopy(key,locale);
  const domain=domains[result.name] ?? {title:'generic' as const};
  const facts=result.presentationFacts ?? legacyFacts(result);
  const success=result.status==='COMPLETED';
  const empty=success && result.resultStatus==='SUCCESS_NO_DATA';
  const failed=result.status==='ERROR';
  const evidenceState:EvidenceState=failed ? 'unavailable' : verification==='VERIFIED' ? 'verified' : verification==='PARTIALLY_VERIFIED' ? 'partial' : verification==='INSUFFICIENT_EVIDENCE' ? 'unavailable' : 'confirmation';
  const label = evidenceState==='unavailable' ? t(failed?'unavailable':'evidenceUnavailable') : t(evidenceState);
  const model:OperationalOverviewViewModel = {
    title:t(domain.title), primaryValue:'', businessStatus:t(success ? (empty?'noRecords':'available') : failed?'unavailable':'confirmation'),
    summary:t(success ? (empty?'noRecords':'retrieved') : failed?'retry':'confirmation'),
    evidenceLabel:label, evidenceState, evidenceSummary:'', metrics:[],
    actions:domain.route ? [{label:`${t('view')} ${t(domain.title).toLocaleLowerCase(locale)}`,route:domain.route}] : [],
  };
  if(success) {
    const normalized={...facts};
    // Zero matching rows proves zero pending/open only for that query's explicit scope.
    if(empty && result.arguments?.['open']===true) {
      if(result.name==='list_actions') normalized.pendingCount=0;
      if(result.name==='list_incidents') normalized.openCount=0;
    }
    Object.assign(model,domain.present?.(normalized,t,n=>new Intl.NumberFormat(locale).format(n)));
    if(empty && result.name==='get_kpi') {model.primaryValue='';model.businessStatus=t('noKpi');model.summary=t('noKpi');model.metrics=[];}
  }
  model.evidenceSummary=model.summary;
  return model;
}
