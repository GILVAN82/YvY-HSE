import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { YvyAiCommandCenterComponent } from './yvy-ai-command-center.component';
import { YvyAiCoreComponent } from './components/yvy-ai-core.component';
import { YvyCapabilityNodeComponent } from './components/yvy-capability-node.component';
import { YvyHudPanelComponent } from './components/yvy-hud-panel.component';
import { YvyWorkflowComponent } from './components/yvy-workflow.component';
import { YvyResponsePanelComponent } from './components/yvy-response-panel.component';
import { AgentInspectorService } from '../../core/agent-inspector.service';
import { NAVIGATION } from '../../core/navigation.config';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

const trace = {
  timestamp:'2026-09-02T00:00:00.000Z',route:['guard','agent','verify','finalize'],tools:[{name:'list_actions',status:'COMPLETED' as const,resultStatus:'SUCCESS_NO_DATA' as const,resultSummary:'0 records'}],
  rag:{used:false,status:'NOT_USED',chunksRetrieved:0},conversation:{stateActive:true,messageCount:2},memory:{used:false,operation:'NONE',categories:[],status:'NOT_USED'},guardrail:{status:'PASS'},
  verification:{status:'VERIFIED' as const,claimsConsidered:1,verifiedClaims:1,unsupportedClaims:0,evidenceItemsConsidered:1,evidenceSourceTypes:['TOOL'],sources:['list_actions'],reasons:[]},
};

describe('YvyAiCommandCenterComponent live interactions', () => {
  let fixture:ComponentFixture<YvyAiCommandCenterComponent>;let component:YvyAiCommandCenterComponent;let inspector:AgentInspectorService;
  beforeEach(async()=>{await TestBed.configureTestingModule({imports:[YvyAiCommandCenterComponent],providers:[provideHttpClient(),provideRouter([])]}).compileComponents();fixture=TestBed.createComponent(YvyAiCommandCenterComponent);component=fixture.componentInstance;inspector=TestBed.inject(AgentInspectorService);inspector.clear();fixture.detectChanges();});
  it('opens the live agent overview from the interactive YvY Core',()=>{fixture.debugElement.query(By.directive(YvyAiCoreComponent)).componentInstance.open.emit();fixture.detectChanges();expect(component.selected()).toBe('core');expect(fixture.nativeElement.textContent).toContain('YvY Agent Overview');});
  it('makes every capability node open contextual details',()=>{const nodes=fixture.debugElement.queryAll(By.directive(YvyCapabilityNodeComponent));expect(nodes.length).toBe(8);nodes.forEach((node,index)=>{node.componentInstance.open.emit();fixture.detectChanges();expect(component.selected()).toBe(component.capabilities[index].id);component.closeDetails();fixture.detectChanges();});});
  it('opens Guard, Tools, RAG, Verification and Human Approval drawers',()=>{const expected=['guard','rag','tools','verify','approval'];fixture.debugElement.queryAll(By.directive(YvyHudPanelComponent)).forEach((panel,index)=>{panel.componentInstance.open.emit();fixture.detectChanges();expect(component.selected()).toBe(expected[index]);component.closeDetails();fixture.detectChanges();});});
  it('opens every workflow stage independently',()=>{const workflow=fixture.debugElement.query(By.directive(YvyWorkflowComponent));for(const stage of ['guard','tools','rag','verify','approval']){workflow.componentInstance.stageOpen.emit(stage);fixture.detectChanges();expect(component.selected()).toBe(stage);component.closeDetails();fixture.detectChanges();}});
  it('expands the AI response panel',()=>{fixture.debugElement.query(By.directive(YvyResponsePanelComponent)).componentInstance.open.emit();fixture.detectChanges();expect(component.selected()).toBe('response');expect(fixture.nativeElement.textContent).toContain('No AI response is available');});
  it('submits Ask YvY through the real agent transport service',async()=>{const send=spyOn(component.agent,'send').and.resolveTo(true);component.prompt='Which actions are overdue?';await component.submit();expect(send).toHaveBeenCalledOnceWith('Which actions are overdue?');expect(component.prompt).toBe('');});
  it('returns focus after the accessible drawer closes',async()=>{const core=fixture.nativeElement.querySelector('app-yvy-ai-core button') as HTMLButtonElement;core.focus();core.click();fixture.detectChanges();await fixture.whenStable();const close=fixture.nativeElement.querySelector('app-yvy-details-drawer header button') as HTMLButtonElement;expect(document.activeElement).toBe(close);close.click();fixture.detectChanges();await Promise.resolve();expect(document.activeElement).toBe(core);});
  it('maps actual tool, verification, RAG-unused and HITL-pending snapshots',()=>{inspector.record({runId:'r',threadId:'t',status:'AWAITING_HUMAN_APPROVAL',responseStatus:'PENDING',stepCount:2,toolsUsed:['list_actions'],ragUsed:false,citations:[],orchestrator:'langgraph',approvalRequest:{approvalId:'a',threadId:'t',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL',status:'PENDING'},executionTrace:trace});component.agent.approval.set({approvalId:'a',threadId:'t',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL',status:'PENDING'});fixture.detectChanges();expect(component.state().agentState).toBe('waiting-approval');expect(component.state().verificationStatus).toBe('VERIFIED');expect(component.executedStages()).toContain('tools');expect(component.executedStages()).not.toContain('rag');component.openDetails('rag');fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('RAG not used for this execution');});
  it('maps the real runtime tool event without timers',()=>{component.agent.runtimeState.set('using-tool');component.agent.activeTool.set('list_actions');fixture.detectChanges();expect(component.state().agentState).toBe('using-tool');expect(component.state().activeWorkflowStage).toBe('tools');});
  it('keeps AI Command Center as the primary destination',()=>{expect(NAVIGATION[0].defaultRoute).toBe('/home');expect(NAVIGATION[0].items[0].label).toBe('AI Command Center');});
});
