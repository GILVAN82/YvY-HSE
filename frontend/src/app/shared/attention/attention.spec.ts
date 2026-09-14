import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AttentionSummaryComponent, AttentionItemComponent } from './attention.component';
import { attentionCopy, presentAttention, attentionEvidence, type AttentionFacts } from './attention.presenter';
import { YvyCommandCenterAgentService } from '../../pages/ai-command-center/yvy-command-center-agent.service';
import { AgentInspectorService } from '../../core/agent-inspector.service';
import { ResponseEvidenceComponent } from '../evidence-view/response-evidence.component';
import { evidenceCopy } from '../evidence-view/evidence-copy';
import { YvyAlertService } from '../../pages/ai-command-center/yvy-alert.service';
const facts:AttentionFacts={approvalActionType:'LOTO_SAFETY_EXECUTION',category:'PENDING_APPROVAL',severity:'CRITICAL',status:'PENDING',projectLabel:'DEMO-LIS-01',sourceType:'HITL',decisionRequired:true};
describe('Canonical operational attention',()=>{
 beforeEach(()=>TestBed.configureTestingModule({providers:[provideHttpClient(),provideRouter([])]}));
 for(const language of Object.keys(attentionCopy))it(`presents count, real severity and localized business copy in ${language}`,()=>{
   const f=TestBed.createComponent(AttentionSummaryComponent);f.componentInstance.language=language;f.componentInstance.count=5;f.componentInstance.critical=1;f.componentInstance.high=4;f.detectChanges();
   const c=attentionCopy[language as keyof typeof attentionCopy];expect(f.nativeElement.textContent).toContain(c.heading);expect(f.nativeElement.textContent).toContain(`5 ${c.many}`);expect(f.nativeElement.textContent).toContain(`1 ${c.critical}`);expect(f.nativeElement.textContent).toContain(`4 ${c.high}`);expect(f.nativeElement.querySelectorAll('button').length).toBe(1);f.destroy();
 });
 it('omits unavailable severity breakdown and uses singular wording',()=>{const f=TestBed.createComponent(AttentionSummaryComponent);f.componentInstance.count=1;f.detectChanges();expect(f.nativeElement.textContent).toContain('1 item needs review');expect(f.nativeElement.querySelector('small')).toBeNull();f.destroy();});
 it('keeps unknown future fields and technical identifiers out of business presentation',()=>{
   const raw:any={...facts,approvalActionType:'FUTURE',category:'NEW_CATEGORY',sourceType:'NEW_SOURCE',projectLabel:'11111111-1111-4111-8111-111111111111',sourceId:'uuid',summary:'Filters: {recordCount:1}',severity:'UNKNOWN'};
   const view=presentAttention(raw);expect(view.title).toBe('Operational review');expect(view.projectLabel).toBeUndefined();expect(view.severity).toBeUndefined();expect(JSON.stringify(view)).not.toMatch(/11111111|recordCount|Filters|NEW_SOURCE|uuid/);
 });
 for(const status of ['APPROVED','REJECTED','ACKNOWLEDGED','RESOLVED'])it(`does not label ${status} as a pending decision`,()=>{expect(presentAttention({...facts,status,decisionRequired:false}).businessStatus).not.toBe('Awaiting human decision');});
 it('shows localized decision basis with verified status and explicit physical limits',()=>{
   for(const language of Object.keys(attentionCopy)){const c=attentionCopy[language as keyof typeof attentionCopy],view=attentionEvidence(facts,language,false);expect(view.verificationState).toBe('PARTIALLY_VERIFIED');expect(view.missing).toContain(c.physical);expect(view.missing).toContain(c.missing);expect(view.title).toBe(c.basis);}
 });
 it('opens only its own evidence and focuses the actual approval control',()=>{
   const a=TestBed.createComponent(AttentionItemComponent),b=TestBed.createComponent(AttentionItemComponent);for(const f of [a,b]){f.componentInstance.facts=facts;f.componentInstance.explained=true;f.detectChanges();}
   const target=document.createElement('section');target.id='approval-control';target.tabIndex=-1;document.body.append(target);const focus=spyOn(target,'focus'),scroll=spyOn(target,'scrollIntoView');a.componentInstance.approvalTarget=target.id;a.detectChanges();
   (Array.from(a.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(x=>x.textContent==='View decision basis')!.click();a.detectChanges();b.detectChanges();expect(a.nativeElement.querySelector('app-evidence-view')).not.toBeNull();expect(b.nativeElement.querySelector('app-evidence-view')).toBeNull();
   a.componentInstance.reviewApproval();expect(focus).toHaveBeenCalled();expect(scroll).toHaveBeenCalled();expect(a.nativeElement.textContent).not.toMatch(/sourceId|approvalId|recordCount|SUCCESS_WITH_DATA|Filters|\{\s*"/);target.remove();a.destroy();b.destroy();
 });
 it('sends hidden alert metadata with no UUID in chat and works without model configuration',async()=>{
   const agent=TestBed.inject(YvyCommandCenterAgentService),id='11111111-1111-4111-8111-111111111111';
   const fetcher=spyOn(globalThis,'fetch').and.resolveTo(new Response(`data: ${JSON.stringify({type:'text',text:'Awaiting human decision.'})}\n\ndata: ${JSON.stringify({type:'done',runId:'r',threadId:'t',status:'COMPLETED',toolsUsed:['get_attention_alert'],ragUsed:false,citations:[]})}\n\n`,{status:200}));
   await agent.send(presentAttention(facts).explainMessage,undefined,undefined,id);const body=JSON.parse(fetcher.calls.mostRecent().args[1]!.body as string);
   expect(body.attentionAlertId).toBe(id);expect(body.message).toBe('Explain this critical LOTO approval alert.');expect(body.pageContext).toBeUndefined();expect(agent.timeline().map(x=>x.text).join(' ')).not.toContain(id);expect(fetcher.calls.count()).toBe(1);
 });
 it('retains only the technical alert reference in Inspector and tracks its linked approval',()=>{
   const inspector=TestBed.inject(AgentInspectorService),id='11111111-1111-4111-8111-111111111111';
   inspector.record({runId:'run',threadId:'explanation-thread',status:'COMPLETED',toolsUsed:['get_attention_alert'],ragUsed:false,citations:[],approvalRequest:{approvalId:'approval',threadId:'request-thread',status:'PENDING'},executionTrace:{tools:[{name:'get_attention_alert',status:'COMPLETED',arguments:{alertId:id,raw:'SECRET'}}]}});
   expect(inspector.latest()?.executionTrace?.tools[0].arguments).toEqual({alertId:id});
   inspector.recordApproval({approvalId:'approval',threadId:'request-thread',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL',status:'REJECTED'});
   expect(inspector.latest()?.approvalRequest?.status).toBe('REJECTED');
 });
 it('uses localized evidence actions and does not attribute operational status to a knowledge source',()=>{
   const response=new ResponseEvidenceComponent();
   for(const language of Object.keys(attentionCopy)){
     response.language=language;response.snapshot={ragUsed:true} as any;expect(response.label).toBe(evidenceCopy('viewSources',language));
     response.snapshot={approvalRequest:{status:'PENDING'}} as any;expect(response.label).toBe(evidenceCopy('viewDecisionBasis',language));
     response.snapshot={executionTrace:{verification:{status:'PARTIALLY_VERIFIED'}}} as any;expect(response.label).toBe(evidenceCopy('whyConfirmation',language));
   }
   const card=new AttentionItemComponent();card.facts=facts;card.snapshot={ragUsed:true,citations:[{citationLabel:'Reference'}],executionTrace:{rag:{status:'OK'},verification:{status:'VERIFIED'}}} as any;
   expect(card.sources[0].conclusion).not.toContain('Awaiting human decision');
 });
 it('removes a resolved approval from active attention immediately, retaining its history',()=>{
   const alerts=TestBed.inject(YvyAlertService);alerts.alerts.set([{id:'alert',sourceType:'HITL',sourceId:'approval',status:'ALERTED',businessStatus:'PENDING',severity:'CRITICAL'} as any]);
   expect(alerts.active().length).toBe(1);alerts.applyApprovalStatus('another-approval','APPROVED');expect(alerts.active().length).toBe(1);
   alerts.applyApprovalStatus('approval','REJECTED');expect(alerts.active().length).toBe(0);expect(alerts.alerts()[0].businessStatus).toBe('REJECTED');
 });
});
