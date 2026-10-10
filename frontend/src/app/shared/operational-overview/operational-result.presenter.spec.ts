import { presentOperationalResult, operationalResults, type OperationalResult } from './operational-result.presenter';

describe('Canonical operational result presentation',()=>{
  const result=(name:string,facts:OperationalResult['presentationFacts']={},extra:Partial<OperationalResult>={}):OperationalResult=>({name,status:'COMPLETED',resultStatus:'SUCCESS_WITH_DATA',presentationFacts:facts,...extra});
  for(const n of [4,0]) it(`presents ${n} pending actions from counted facts`,()=>{
    const vm=presentOperationalResult(result('list_actions',{pendingCount:n}),'VERIFIED');
    expect(vm.primaryValue).toBe(String(n));expect(vm.businessStatus).toBe('pending');
    if(!n)expect(vm.summary).toBe('No pending actions found.');
  });
  for(const n of [2,0]) it(`presents ${n} open incidents independently of the total register`,()=>{
    const vm=presentOperationalResult(result('list_incidents',{openCount:n,totalCount:12}),'VERIFIED');
    expect(vm.primaryValue).toBe(String(n));expect(vm.businessStatus).toBe('open');
    if(!n)expect(vm.summary).toBe('No open incidents found.');
  });
  it('does not call unfiltered action counts pending',()=>expect(presentOperationalResult(result('list_actions',{recordCount:4}),'VERIFIED').primaryValue).toBe(''));
  it('labels a capped action count as a lower bound',()=>expect(presentOperationalResult(result('list_actions',{pendingCount:20,countIsLowerBound:true}),'VERIFIED').primaryValue).toBe('At least 20'));
  it('shows available KPI data without inventing values',()=>{const vm=presentOperationalResult(result('get_kpi'),'VERIFIED');expect(vm.businessStatus).toBe('Data available');expect(vm.metrics).toEqual([]);});
  it('shows only actual KPI values, including zero',()=>{const vm=presentOperationalResult(result('get_kpi',{metrics:{trir:.42,ltifr:0,daysSinceLTI:128}}),'VERIFIED');expect(vm.metrics).toEqual([{label:'TRIR',value:'0.42'},{label:'LTIFR',value:'0.00'},{label:'Days since LTI',value:'128'}]);});
  it('does not call a successful empty KPI query an error',()=>{const vm=presentOperationalResult(result('get_kpi',{}, {resultStatus:'SUCCESS_NO_DATA'}),'VERIFIED');expect(vm.businessStatus).toBe('No matching performance indicators');expect(vm.evidenceLabel).toBe('Verified');});
  it('distinguishes no matching records from no open records',()=>{const vm=presentOperationalResult(result('list_incidents',{}, {resultStatus:'SUCCESS_NO_DATA'}),'VERIFIED');expect(vm.businessStatus).toBe('No matching records');expect(vm.primaryValue).toBe('');});
  it('recognizes successful zero results in an explicit open scope',()=>{const vm=presentOperationalResult(result('list_incidents',{}, {resultStatus:'SUCCESS_NO_DATA',arguments:{open:true}}),'VERIFIED');expect(vm.primaryValue).toBe('0');expect(vm.summary).toBe('No open incidents found.');});
  it('errors take precedence over stale counts and verification',()=>{const vm=presentOperationalResult(result('list_actions',{pendingCount:4},{status:'ERROR'}),'VERIFIED');expect(vm.primaryValue).toBe('');expect(vm.businessStatus).toBe('Data unavailable');expect(vm.evidenceState).toBe('unavailable');});
  for(const [status,label] of [['VERIFIED','Verified'],['PARTIALLY_VERIFIED','Partially verified'],['INSUFFICIENT_EVIDENCE','Evidence unavailable'],['CONTRADICTED','Needs confirmation']])
    it(`maps ${status} independently of execution success`,()=>expect(presentOperationalResult(result('get_kpi'),status).evidenceLabel).toBe(label));
  it('uses a generic future-source fallback without exposing identifiers or metadata',()=>{const vm=presentOperationalResult(result('future_inspection_tool',{}, {resultSummary:'{"recordCount":8,"status":"SUCCESS_WITH_DATA"}',arguments:{secret:'private'}}),'VERIFIED');expect(vm.title).toBe('Operational data');expect(vm.businessStatus).toBe('Data available');expect(vm.actions).toEqual([]);});
  for(const language of ['en','pt','es','fr','de']) it(`localizes all visible labels in ${language} and excludes raw metadata`,()=>{
    for(const name of ['list_actions','list_incidents','get_kpi','future_tool']) for(const status of ['COMPLETED','ERROR','NOT_OBSERVABLE'] as const) {
      const vm=presentOperationalResult(result(name,{}, {status,resultSummary:'SUCCESS_WITH_DATA Filters: {} recordCount raw args'}),'PARTIALLY_VERIFIED',language);
      const text=[vm.title,vm.primaryValue,vm.businessStatus,vm.summary,vm.evidenceLabel,vm.evidenceSummary,...vm.actions.map(a=>a.label)].join(' ');
      expect(text).not.toMatch(/SUCCESS_WITH_DATA|SUCCESS_NO_DATA|COMPLETED|Filters:|recordCount|raw args|[{}]/);
      expect(text).not.toContain('undefined');
      if(language!=='en')expect(vm.businessStatus).not.toBe('Data available');
    }
  });
  it('fails safely for unsupported locales and old technical summaries',()=>expect(presentOperationalResult(result('list_actions',undefined,{resultSummary:'COMPLETED'}),'VERIFIED','xx').businessStatus).toBe('Data available'));
  it('does not turn RAG or memory tools into operational cards',()=>expect(operationalResults({executionTrace:{intent:{intent:'OPERATIONAL_OVERVIEW'},tools:[result('search_hse_knowledge'),result('save_memory'),result('future_tool')]}} as any).map(t=>t.name)).toEqual(['future_tool']));
});
