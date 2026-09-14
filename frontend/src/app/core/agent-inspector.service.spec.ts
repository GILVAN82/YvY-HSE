import { TestBed } from '@angular/core/testing';
import { AgentInspectorService } from './agent-inspector.service';

describe('AgentInspectorService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('clears only the browser-side execution snapshot', () => {
    const service = TestBed.inject(AgentInspectorService);
    service.record({
      runId: 'run-1', threadId: 'thread-1', status: 'COMPLETED', stepCount: 1,
      toolsUsed: [], ragUsed: false, citations: [], orchestrator: 'langgraph',
    });

    expect(service.latest()?.runId).toBe('run-1');
    expect(sessionStorage.length).toBe(1);

    service.clear();

    expect(service.latest()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('accepts a resolved approval only from the matching persisted thread response', () => {
    const service = TestBed.inject(AgentInspectorService);
    service.record({ runId: 'run-1', threadId: 'thread-1', status: 'AWAITING_HUMAN_APPROVAL', stepCount: 2, toolsUsed: [], ragUsed: false, citations: [], orchestrator: 'langgraph' });
    service.recordApproval({ approvalId: 'approval-1', threadId: 'other-thread', actionType: 'LOTO_SAFETY_EXECUTION', riskLevel: 'CRITICAL', status: 'APPROVED', resolvedAt: '2026-08-12T12:00:00.000Z' });
    expect(service.latest()?.status).toBe('AWAITING_HUMAN_APPROVAL');
    service.recordApproval({ approvalId: 'approval-1', threadId: 'thread-1', actionType: 'LOTO_SAFETY_EXECUTION', riskLevel: 'CRITICAL', status: 'APPROVED', resolvedAt: '2026-08-12T12:00:00.000Z' });
    expect(service.latest()?.status).toBe('APPROVED');
    expect(service.latest()?.responseStatus).toBe('APPROVED');
    expect(service.latest()?.approvalRequest?.resolvedAt).toBe('2026-08-12T12:00:00.000Z');
  });

  it('retains the sanitized semantic verification decision for the Inspector', () => {
    const service = TestBed.inject(AgentInspectorService);
    service.record({
      runId:'run-verify',threadId:'thread-verify',status:'FAILED',stepCount:2,toolsUsed:['list_actions'],ragUsed:false,citations:[],orchestrator:'langgraph',
      executionTrace:{timestamp:'2026-09-01T00:00:00.000Z',route:['guard','agent','verify','finalize_failure'],tools:[],rag:{used:false,status:'NOT_USED',chunksRetrieved:0},conversation:{stateActive:false,messageCount:1},memory:{used:false,operation:'NONE',categories:[],status:'NOT_USED'},guardrail:{status:'PASS'},verification:{status:'CONTRADICTED',claimsConsidered:1,verifiedClaims:0,unsupportedClaims:1,evidenceItemsConsidered:1,evidenceSourceTypes:['TOOL'],sources:['list_actions'],reasons:['Response contradicts current tool evidence.']}},
    });
    expect(service.latest()?.executionTrace?.verification.status).toBe('CONTRADICTED');
    expect(service.latest()?.executionTrace?.verification.unsupportedClaims).toBe(1);
    expect(JSON.stringify(service.latest())).not.toContain('chainOfThought');
  });

  it('retains prompt identity and timing while excluding request text and draft payloads', () => {
    const service = TestBed.inject(AgentInspectorService);
    service.record({runId:'r',threadId:'t',status:'FAILED',stepCount:1,toolsUsed:[],ragUsed:false,citations:[],orchestrator:'langgraph',recordDraft:{private:'PRIVATE_DRAFT'},
      executionTrace:{timestamp:'now',route:[],tools:[{name:'search_hse_knowledge',status:'ERROR',arguments:{query:'PRIVATE_QUERY'}}],intent:{input:'PRIVATE_INPUT',normalizedQuery:'PRIVATE_INPUT',intent:'SEARCH_HSE_KNOWLEDGE',candidateTools:[]},
        observability:{prompt:{version:'agent-g-v1',fingerprint:'abc'},provider:'mock',model:'mock-model',stages:[{stage:'provider',durationMs:12}],usage:{status:'NOT_AVAILABLE'},cost:'NOT_AVAILABLE',error:{category:'MODEL',code:'MODEL_TIMEOUT',recoverable:true}}}
    });
    const snapshot=service.latest();
    expect(snapshot?.executionTrace?.observability?.prompt?.version).toBe('agent-g-v1');
    expect(snapshot?.executionTrace?.observability?.stages[0].durationMs).toBe(12);
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_');
    expect(sessionStorage.getItem('yvy-hse-agent-inspector-latest')).not.toContain('PRIVATE_');
  });
});


describe('Inspector snapshot compatibility', () => {
  afterEach(() => sessionStorage.clear());
  it('normalizes an incomplete pending-approval snapshot on record and reload', () => {
    const first = new AgentInspectorService();
    first.record({runId:'legacy',threadId:'thread',status:'COMPLETED'});
    expect(first.latest()?.toolsUsed).toEqual([]);
    expect(new AgentInspectorService().latest()?.toolsUsed).toEqual([]);
  });
  it('rejects malformed supplied tools and missing identity instead of inventing success', () => {
    for (const payload of [{runId:'r'}, {runId:'r',threadId:'t',status:'COMPLETED',toolsUsed:'bad'}, {runId:'r',threadId:'t',status:'COMPLETED',toolsUsed:[42]}]) {
      sessionStorage.setItem('yvy-hse-agent-inspector-latest',JSON.stringify(payload));
      expect(new AgentInspectorService().latest()).toBeNull();
      const service = new AgentInspectorService(); service.record(payload);
      expect(service.latest()).toBeNull();
    }
  });
});
