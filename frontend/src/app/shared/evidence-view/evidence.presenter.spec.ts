import { businessText, presentOperationalEvidence, presentResponseEvidence, type EvidenceSnapshot } from './evidence.presenter';
import type { OperationalResult } from '../operational-overview/operational-result.presenter';

describe('Canonical Evidence View presenter',()=>{
  const tool:OperationalResult={name:'list_actions',status:'COMPLETED',resultStatus:'SUCCESS_WITH_DATA',presentationFacts:{pendingCount:4}};
  const snapshot=(status='VERIFIED'):EvidenceSnapshot=>({runId:'private-run',threadId:'thread',status:'COMPLETED',toolsUsed:['list_actions'],stepCount:1,ragUsed:false,citations:[],orchestrator:'langgraph',executionTrace:{timestamp:'2026-09-14T10:00:00Z',route:[],tools:[tool],rag:{used:false,status:'NOT_USED',chunksRetrieved:0},conversation:{stateActive:true,messageCount:2},memory:{used:false,operation:'NONE',categories:[],status:'NOT_USED'},guardrail:{status:'PASS'},verification:{status:status as any,claimsConsidered:1,verifiedClaims:1,unsupportedClaims:0,evidenceItemsConsidered:1,evidenceSourceTypes:['TOOL'],sources:['list_actions'],reasons:['raw internal reason']}}});
  it('presents verified counts, identifiers, scope, source and historical query time',()=>{
    const s=snapshot();s.evidencePresentation={operational:[{source:'list_actions',scope:'DEMO-LIS-01',checkedAt:'2026-09-14T10:00:00Z',items:[{identifier:'DEMO-ACT-001',status:'Open'}]}],documents:[]};
    const vm=presentOperationalEvidence(tool,s);expect(vm.conclusion).toBe('Actions: 4 pending');expect(vm.verificationState).toBe('VERIFIED');expect(vm.sourceLabel).toBe('Actions / CAPA Register');expect(vm.scopeLabel).toBe('DEMO-LIS-01');expect(vm.checkedAt).toBeDefined();expect(vm.evidenceItems.some(i=>i.label==='DEMO-ACT-001'&&i.value==='Open')).toBeTrue();expect(vm.sourceAction).toEqual({label:'View details',route:'/sheet/Action Tracker (CAPA)'});
  });
  it('distinguishes valid zero results from unavailable data',()=>{
    const zero:OperationalResult={name:'list_incidents',status:'COMPLETED',resultStatus:'SUCCESS_NO_DATA',presentationFacts:{openCount:0}};
    const vm=presentOperationalEvidence(zero,snapshot());expect(vm.verificationState).toBe('NO_MATCHING_RECORDS');expect(vm.conclusion).toContain('0 open');expect(vm.explanation).toContain('not a retrieval failure');
    const failed=presentOperationalEvidence({...zero,status:'ERROR'},snapshot());expect(failed.verificationState).toBe('EVIDENCE_UNAVAILABLE');expect(failed.checkedAt).toBeUndefined();expect(failed.evidenceItems).toEqual([]);
  });
  it('does not upgrade a partial zero result to verified',()=>expect(presentOperationalEvidence({...tool,resultStatus:'SUCCESS_NO_DATA',presentationFacts:{pendingCount:0}},snapshot('PARTIALLY_VERIFIED')).verificationState).toBe('PARTIALLY_VERIFIED'));
  it('explains available and missing support without leaking raw verification reasons',()=>{
    const vm=presentOperationalEvidence(tool,snapshot('PARTIALLY_VERIFIED'));expect(vm.available).toContain('Actions');expect(vm.missing.length).toBeGreaterThan(0);expect(vm.explanation).toContain('could not be fully supported');expect(vm.nextStep).toBeDefined();expect(JSON.stringify(vm)).not.toContain('raw internal reason');
  });
  it('presents RAG documents, passages, jurisdiction and safe links',()=>{
    const s=snapshot();s.ragUsed=true;s.evidencePresentation={operational:[],documents:[{title:'LOTO guidance',citation:'[OSHA LOTO]',passage:'Verify isolation before work.',organization:'OSHA',jurisdiction:'US',version:'2026',url:'https://www.osha.gov/control-hazardous-energy'}]};
    const vm=presentResponseEvidence(s,'Check isolation before work.')[0];expect(vm.conclusion).toContain('Check isolation');expect(vm.evidenceItems[0].passage).toContain('Verify isolation');expect(vm.evidenceItems[0].jurisdiction).toBe('US');expect(vm.evidenceItems[0].version).toBe('2026');expect(vm.scopeLabel).toBeUndefined();expect(vm.explanation).toContain('does not establish applicability');expect(vm.evidenceItems[0].action).toBeDefined();
  });
  it('does not invent passages, scope or jurisdiction for old citations',()=>{
    const s=snapshot();s.citations=[{sourceId:'internal-id',citationLabel:'Approved procedure',jurisdiction:'',sourceUrl:'javascript:alert(1)'}];
    const vm=presentResponseEvidence(s,'Answer')[0];expect(vm.evidenceItems[0].jurisdiction).toBeUndefined();expect(vm.scopeLabel).toBeUndefined();expect(vm.evidenceItems[0].passage).toContain('not included');expect(vm.evidenceItems[0].action).toBeUndefined();expect(JSON.stringify(vm)).not.toContain('internal-id');
  });
  it('does not invent a scope or time when none was provided',()=>{const s=snapshot();delete s.executionTrace;const vm=presentOperationalEvidence(tool,s);expect(vm.scopeLabel).toBeUndefined();expect(vm.jurisdiction).toBeUndefined();expect(vm.checkedAt).toBeUndefined();});
  it('shows the human decision basis without treating approval as physical verification',()=>{
    const s=snapshot();s.approvalRequest={approvalId:'a',threadId:'thread',status:'PENDING',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL'};
    const pending=presentResponseEvidence(s,'', 'en',undefined,'actual-panel')[0];expect(pending.verificationState).toBe('HUMAN_DECISION_REQUIRED');expect(pending.explanation).toContain('cannot confirm physical isolation');expect(pending.nextAction).toEqual({label:'View approval',approvalTarget:'actual-panel'});
    const approved=presentResponseEvidence(s,'','en',{...s.approvalRequest,status:'APPROVED'})[0];expect(approved.conclusion).toBe('Approval recorded');expect(approved.verificationState).toBe('NEEDS_CONFIRMATION');
    const unrelated=presentResponseEvidence(s,'','en',{...s.approvalRequest,approvalId:'other',status:'APPROVED'})[0];expect(unrelated.verificationState).toBe('HUMAN_DECISION_REQUIRED');expect(unrelated.nextAction).toBeUndefined();
  });
  it('uses a safe unknown-source fallback',()=>{const vm=presentOperationalEvidence({...tool,name:'future_tool',presentationFacts:undefined,resultSummary:'{"secret":"value"}'},snapshot());expect(vm.sourceLabel).toBe('Operational data');expect(vm.sourceAction).toBeUndefined();expect(JSON.stringify(vm)).not.toContain('secret');});
  for(const language of ['en','pt','es','fr','de'])it(`localizes evidence in ${language} without technical output`,()=>{
    const vm=presentOperationalEvidence({...tool,resultSummary:'SUCCESS_WITH_DATA Filters: {} recordCount embedding metadata RRF score'},snapshot('PARTIALLY_VERIFIED'),language);
    expect(JSON.stringify(vm)).not.toMatch(/SUCCESS_WITH_DATA|SUCCESS_NO_DATA|Filters:|recordCount|RRF score|embedding metadata|list_actions|private-run|raw internal reason/);
    if(language!=='en')expect(vm.verificationLabel).not.toBe('Partially verified');
  });
  it('rejects technical metadata as user-facing text',()=>{for(const input of ['SUCCESS_WITH_DATA','SUCCESS_NO_DATA','Filters: {}','recordCount: 4','RRF score: 1','embedding dimensions 1536','{"data":4}','vector score: 1'])expect(businessText(input)).toBeUndefined();});
});
