import { YvyAiCommandCenterComponent } from '../../pages/ai-command-center/yvy-ai-command-center.component';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { YvyCommandCenterAgentService } from '../../pages/ai-command-center/yvy-command-center-agent.service';
import { AttentionItemComponent } from './attention.component';
import { attentionEvidence } from './attention.presenter';
import { AgentInspectorService } from '../../core/agent-inspector.service';
const first={approvalId:'11111111-1111-4111-8111-111111111111',threadId:'thread1',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL',status:'PENDING' as const};
const second={...first,approvalId:'22222222-2222-4222-8222-222222222222',threadId:'thread2'};
const facts={basisSource:'APPROVAL_REGISTER' as const,sourceType:'HITL',category:'PENDING_APPROVAL',approvalActionType:'LOTO_SAFETY_EXECUTION',severity:'CRITICAL',status:'PENDING',projectLabel:'P1',decisionRequired:true};
describe('Canonical pending approval cards',()=>{
 beforeEach(()=>TestBed.configureTestingModule({providers:[provideHttpClient(),provideRouter([])]}));
 it('selects an exact returned approval and preserves its original request thread',()=>{
  const agent=TestBed.inject(YvyCommandCenterAgentService);agent.timeline.set([{id:'message',role:'YVY',text:'2 approvals are awaiting your decision.',status:'COMPLETE',createdAt:'',snapshot:{pendingApprovals:[{approval:first,facts},{approval:second,facts}],approvalRequest:first} as any}]);
  agent.selectPendingApproval('message',{...second,approvalId:'forged'});expect(agent.approval()).toBeNull();agent.selectPendingApproval('message',second);expect(agent.approval()).toEqual(second);expect(agent.timeline()[0].snapshot?.approvalRequest?.threadId).toBe('thread2');
 });
 it('shows a verified approval-register basis without inventing a RAG outage or physical verification',()=>{
  const model=attentionEvidence(facts);expect(model.sourceLabel).toBe('Human approval register');expect(model.verificationState).toBe('VERIFIED');expect(model.missing.join(' ')).toContain('cannot verify physical isolation');expect(model.missing.join(' ')).not.toContain('unavailable');
 });
 it('renders independent business cards with no UUID or raw data',()=>{
  const a=TestBed.createComponent(AttentionItemComponent),b=TestBed.createComponent(AttentionItemComponent);for(const f of [a,b]){f.componentInstance.facts=facts;f.componentInstance.explained=true;f.componentInstance.approvalTarget='approval';f.detectChanges();}
  a.componentInstance.evidenceOpen=true;a.detectChanges();expect(a.nativeElement.querySelector('app-evidence-view')).not.toBeNull();expect(b.nativeElement.querySelector('app-evidence-view')).toBeNull();expect(a.nativeElement.textContent).toContain('View decision basis');expect(a.nativeElement.textContent).toContain('Review approval');expect(a.nativeElement.textContent).not.toMatch(/sourceId|approvalId|11111111|raw JSON|No matching records/);a.destroy();b.destroy();
 });
 it('Inspector retains scope and count but excludes unrelated tool arguments',()=>{
  const inspector=TestBed.inject(AgentInspectorService);inspector.record({runId:'r',threadId:'t',status:'COMPLETED',executionTrace:{tools:[{name:'list_pending_approvals',status:'COMPLETED',arguments:{scope:'P1',raw:'secret'},resultSummary:'2 pending approval(s)'}]}});
  expect(inspector.latest()?.executionTrace?.tools[0].arguments).toEqual({scope:'P1'});expect(inspector.latest()?.executionTrace?.tools[0].resultSummary).toBe('2 pending approval(s)');
 });
});


describe('Pending approvals followed by Command Center', () => {
 afterEach(() => { TestBed.resetTestingModule(); sessionStorage.clear(); });
 it('loads the workspace after an incomplete approval snapshot survives a suite boundary', async () => {
  TestBed.configureTestingModule({});
  TestBed.inject(AgentInspectorService).record({runId:'approval-run',threadId:'approval-thread',status:'COMPLETED'});
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({imports:[YvyAiCommandCenterComponent],providers:[provideHttpClient(),provideRouter([])]}).compileComponents();
  const fixture=TestBed.createComponent(YvyAiCommandCenterComponent);
  expect(() => fixture.detectChanges()).not.toThrow();
  expect(fixture.componentInstance.agent.latest()?.toolsUsed).toEqual([]);
  fixture.destroy();
 });
});
