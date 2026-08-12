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
    expect(service.latest()?.approvalRequest?.resolvedAt).toBe('2026-08-12T12:00:00.000Z');
  });
});
