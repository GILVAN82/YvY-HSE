import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { AgentInspectorService, ApprovalSnapshot, AgentInspectorSnapshot, DemoHumanApprovalContext } from '../../../core/agent-inspector.service';
import { environment } from '../../../../environments/environment';
import { YvyCommandCenterAgentService } from '../yvy-command-center-agent.service';
import { VoiceEngineService } from '../voice/voice-engine.service';
import { SpokenResponseFormatterService } from '../voice/spoken-response-formatter.service';
import { presentResponseEvidence } from '../../../shared/evidence-view/evidence.presenter';
import { DEMO_STEPS } from './demo-script';

export interface DemoPreflight {status:'READY'|'READY_WITH_WARNINGS'|'BLOCKED';authenticated:boolean;agent:boolean;rag:boolean;operational:boolean;routes:boolean;inspector:boolean;voice:'CONFIGURED'|'DEGRADED';project:string|null;canApprove:boolean;approval:ApprovalSnapshot|null}
export type DemoState='IDLE'|'PREFLIGHT'|'INTRODUCTION'|'TOOL_CALLING'|'RAG'|'MEMORY'|'HITL'|'WAITING_FOR_HUMAN'|'CLOSING'|'COMPLETED'|'PAUSED'|'FAILED_STEP';
@Injectable({providedIn:'root'})
export class TuringDemoService {
  readonly agent=inject(YvyCommandCenterAgentService);private readonly auth=inject(AuthService);
  private readonly voice=inject(VoiceEngineService);private readonly formatter=inject(SpokenResponseFormatterService);
  readonly inspector=inject(AgentInspectorService);
  readonly enabled=signal(false);readonly active=signal(false);readonly state=signal<DemoState>('IDLE');readonly index=signal(0);
  readonly steps=DEMO_STEPS;readonly step=computed(()=>this.steps[this.index()]);readonly preflight=signal<DemoPreflight|null>(null);
  readonly busy=signal(false);readonly completed=signal(false);readonly message=signal('');readonly voiceDegraded=signal(false);
  readonly technical=signal(false);readonly elapsed=signal(0);readonly outcomes=signal<Record<string,string>>({});
  readonly approvalBusy=signal(false);
  readonly demoSessionId=signal('');
  readonly humanContext=signal<DemoHumanApprovalContext|null>(null);
  readonly previousDecision=signal<ApprovalSnapshot|null>(null);
  readonly knowledgeBasis=signal<AgentInspectorSnapshot|null>(null);
  readonly decisionEvidence=computed(()=>{
    const basis=this.knowledgeBasis(),run=this.inspector.demoApprovalRun();
    return [...(basis?presentResponseEvidence(basis,'Approved guidance retrieved during this presentation.','en'):[]),...(run?presentResponseEvidence(run,'Human decision required.','en',this.agent.approval()??undefined):[])];
  });
  private readonly approvalRuns=new Map<string,AgentInspectorSnapshot>();
  private resetHumanSession(){this.demoSessionId.set(crypto.randomUUID());this.humanContext.set(null);this.previousDecision.set(null);this.knowledgeBasis.set(null);this.inspector.demoHumanContext.set(null);this.inspector.demoApprovalRun.set(null);}
  private setHumanContext(value:DemoHumanApprovalContext){this.humanContext.set(value);this.inspector.demoHumanContext.set(value);}

  readonly navigating=signal(false);readonly notice=signal('');readonly durations=signal<Record<string,number>>({});
  private navigationTimer?:ReturnType<typeof setTimeout>;private clockVersion=0;private stepStartedAt=0;
  private resumeWait?:()=>void;
  private generation=0;private clock?:ReturnType<typeof setInterval>;private deadline?:ReturnType<typeof setTimeout>;private startTime=0;
  private pausedState:DemoState='IDLE';private pendingAdvance=false;private normalInspectorPreset=false;
  private controller?:AbortController;
  constructor(){let owner=this.auth.user()?.userId;effect(()=>{const current=this.auth.user()?.userId;if(current!==owner){owner=current;this.exit();this.enabled.set(false);void this.loadFlag();}},{allowSignalWrites:true});effect(()=>{const approval=this.agent.approval();if(this.active()&&this.state()==='WAITING_FOR_HUMAN'&&approval&&approval.status!=='PENDING')untracked(()=>this.observeApproval());},{allowSignalWrites:true});}
  async loadFlag(){const owner=this.auth.user()?.userId;if(!owner)return;try{const r=await fetch(`${environment.apiUrl}/ai/turing-demo/config`,{credentials:'include'});const body=await r.json();if(owner===this.auth.user()?.userId)this.enabled.set(r.ok&&body.enabled===true);}catch{this.enabled.set(false);}}
  private markerKey(){return `yvy-turing-hitl-${this.auth.user()?.userId??'none'}`;}
  private readMarker(){try{return sessionStorage.getItem(this.markerKey());}catch{return 'UNKNOWN';}}
  private storeMarker(thread:string){try{sessionStorage.setItem(this.markerKey(),thread);return true;}catch{return false;}}
  private async check():Promise<DemoPreflight>{
    const marker=this.readMarker(),query=marker&&marker!=='UNKNOWN'?`?threadId=${encodeURIComponent(marker)}`:'';
    const response=await fetch(`${environment.apiUrl}/ai/turing-demo/preflight${query}`,{credentials:'include',signal:this.controller?.signal});
    if(!response.ok)throw new Error('Preflight unavailable');return response.json();
  }
  async open(){
    if(!this.enabled()||this.active()||this.agent.loading())return;
    this.resetHumanSession();this.voice.stop();this.voiceDegraded.set(false);this.active.set(true);this.state.set('PREFLIGHT');this.message.set('Checking presentation readiness…');this.preflight.set(null);
    this.normalInspectorPreset=this.inspector.demoPreset();const token=++this.generation;this.controller=new AbortController();
    try{const result=await this.check();if(!this.current(token))return;this.preflight.set(result);this.message.set(result.operational?'Review preflight, then Continue.':'Demo operational data unavailable. Operational, memory and HITL steps can be skipped.');}
    catch{if(this.current(token))this.message.set('Preflight unavailable. Exit and check the authenticated server configuration.');}
  }
  async continue(){
    if(!this.active()||this.navigating())return;
    this.notice.set('');
    if(this.state()==='PAUSED'){this.state.set(this.pausedState);this.resumeWait?.();this.resumeWait=undefined;if(this.pendingAdvance){this.startClock();await this.execute();}return;}
    if(this.busy())return;
    if(this.pendingAdvance){this.startClock();await this.execute();return;}
    if(this.state()==='PREFLIGHT'){
      if(!this.preflight()||this.preflight()!.status==='BLOCKED')return;
      if(!this.agent.beginPresentation()){this.message.set('Wait for the current conversation request to finish.');return;}
      this.startClock();await this.execute();return;
    }
    if(this.state()==='WAITING_FOR_HUMAN'){this.message.set('A manual Approve or Reject decision is required, or explicitly Skip this step.');return;}
    if(this.completed()||this.state()==='FAILED_STEP')await this.next();
  }
  pause(){if(!this.active()||this.navigating()||this.state()==='PREFLIGHT'||this.state()==='PAUSED'||this.state()==='COMPLETED')return;this.pausedState=this.state();this.state.set('PAUSED');this.voice.stop();}
  async skip(){
    if(!this.active()||['PREFLIGHT','COMPLETED'].includes(this.state())||this.approvalBusy()||this.navigating())return;
    this.lockNavigation();const pending=this.hasPendingApproval();this.cancelStep();this.recordOutcome('SKIPPED');
    this.notice.set(pending?'Step skipped. The human approval remains pending.':'Step skipped.');await this.next();
  }
  async retry(){if(this.state()!=='FAILED_STEP'||this.busy()||this.navigating())return;this.notice.set('');await this.execute();}
  restart(){
    if(!this.active()||this.state()==='PREFLIGHT'||this.navigating())return;
    this.lockNavigation();this.stopClock();this.cancelStep();this.resetHumanSession();
    // Presentation state is reset locally. The application approval and dispatch
    // marker are deliberately retained and rechecked by the authorized preflight at HITL.
    this.index.set(0);this.state.set('INTRODUCTION');this.pausedState='INTRODUCTION';this.pendingAdvance=true;
    this.outcomes.set({});this.durations.set({});this.completed.set(false);this.elapsed.set(0);this.stepStartedAt=0;
    this.technical.set(false);this.inspector.demoPreset.set(this.normalInspectorPreset);this.inspector.demoApproval.set(null);
    this.approvalBusy.set(false);this.voiceDegraded.set(false);this.agent.error.set('');
    this.notice.set('Demo restarted.');this.message.set('Introduction ready. Continue when ready.');
  }
  exit(){if(!this.active())return;this.cancelStep();this.resetHumanSession();this.stopClock();if(this.navigationTimer)clearTimeout(this.navigationTimer);this.navigationTimer=undefined;this.navigating.set(false);this.notice.set('');this.durations.set({});this.approvalBusy.set(false);this.agent.endPresentation();this.inspector.demoPreset.set(this.normalInspectorPreset);this.inspector.demoApproval.set(null);this.active.set(false);this.state.set('IDLE');this.index.set(0);this.preflight.set(null);this.outcomes.set({});this.completed.set(false);this.elapsed.set(0);this.technical.set(false);this.message.set('');this.pendingAdvance=false;}
  private cancelStep(){this.generation++;if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;this.controller?.abort();this.controller=undefined;this.resumeWait?.();this.resumeWait=undefined;this.agent.stopPresentationRequest();this.voice.stop();this.busy.set(false);}
  private hasPendingApproval(){return this.agent.approval()?.status==='PENDING'||this.preflight()?.approval?.status==='PENDING';}
  private lockNavigation(){this.navigating.set(true);if(this.navigationTimer)clearTimeout(this.navigationTimer);this.navigationTimer=setTimeout(()=>{this.navigating.set(false);this.navigationTimer=undefined;},250);}
  private stopClock(){this.clockVersion++;if(this.clock)clearInterval(this.clock);this.clock=undefined;}
  private startClock(){this.stopClock();this.startTime=Date.now();const version=this.clockVersion;this.clock=setInterval(()=>{if(version===this.clockVersion)this.elapsed.set(Math.floor((Date.now()-this.startTime)/1000));},1000);}
  private recordOutcome(status:string){const id=this.step().id;this.outcomes.update(o=>({...o,[id]:status}));this.durations.update(d=>({...d,[id]:this.stepStartedAt?Math.max(0,Date.now()-this.stepStartedAt):0}));}
  private current(token:number){return this.active()&&token===this.generation;}
  private async next(){if(this.index()===5){this.state.set('COMPLETED');this.stopClock();return;}this.index.update(n=>n+1);await this.execute();}
  private fail(message=this.step().fallbackMessage){this.message.set(message);this.outcomes.update(o=>({...o,[this.step().id]:'FAILED'}));if(this.state()==='PAUSED')this.pausedState='FAILED_STEP';else this.state.set('FAILED_STEP');this.completed.set(false);}
  private async execute(){
    this.pendingAdvance=false;this.resumeWait?.();this.resumeWait=undefined;this.voice.stop();this.controller=new AbortController();this.stepStartedAt=Date.now();const step=this.step(),token=++this.generation;this.busy.set(true);this.completed.set(false);this.state.set(step.id);this.message.set(step.purpose);this.technical.set(false);this.outcomes.update(o=>{const next={...o};delete next[step.id];return next;});if(step.id!=='HITL'){this.inspector.demoHumanContext.set(null);this.inspector.demoApprovalRun.set(null);}
    this.deadline=setTimeout(()=>{if(this.current(token)){this.cancelStep();this.fail('This step timed out. Its server outcome may be pending; retry checks existing human decisions before any request.');}},step.timeoutMs);
    try{
      if(step.narration){this.agent.presentationNarration(step.narration);this.speak(step.narration);this.finishStep();return;}
      const live=await this.check();if(!this.current(token))return;this.preflight.set(live);
      if(live.status==='BLOCKED'){this.fail('Agent unavailable. Retry or skip this step.');return;}
      if(['TOOL_CALLING','MEMORY','HITL'].includes(step.id)&&!live.operational){this.fail('Demo operational data unavailable. Prepare the dedicated synthetic context or skip this step.');return;}
      if(step.id==='RAG'&&(!live.rag||!live.operational)){this.fail('Approved RAG corpus or safe demo context unavailable. No evidence is claimed.');return;}
      if(step.id==='HITL'){
        if(live.approval?.status==='PENDING'){
          if(!this.storeMarker(live.approval.threadId)){this.fail('Unable to retain the existing approval reference. No request was sent.');return;}
          this.bindPending(live.approval,live.project!);return;
        }
        if(live.approval)this.previousDecision.set(live.approval);
        if(!live.approval&&this.readMarker()){this.fail('A previous demo approval request was dispatched. Its outcome is unresolved or unavailable. No duplicate request will be sent.');return;}
        // A finalized resource is history. A fresh owned conversation is the new
        // request instance; persist its dispatch marker before the real agent call.
        const thread=live.approval?crypto.randomUUID():this.agent.presentationThreadId;
        if(!thread || (live.approval&&!this.agent.selectPresentationRequestInstance(thread)) || !this.storeMarker(thread)){this.fail('Unable to retain the approval request marker. No request was sent.');return;}
        const ok=await this.agent.send(`Approve LOTO ${live.project} as safe for execution.`);if(!this.current(token))return;
        const approval=this.agent.approval();
        if(!ok||!approval||approval.status!=='PENDING'||approval.threadId!==thread){this.fail('The critical request did not return a pending approval. Retry checks the server without repeating the request.');return;}
        this.bindPending(approval,live.project!);return;
      }
      for(const prompt of step.prompts??[]){
        // Pausing never sends the next memory turn until Continue is explicitly pressed.
        if(this.current(token)&&this.state()==='PAUSED')await new Promise<void>(resolve=>this.resumeWait=resolve);
        if(!this.current(token))return;
        const prior=this.agent.latest()?.runId,ok=await this.agent.send(prompt);if(!this.current(token))return;
        const snapshot=this.agent.latest();if(!ok||!snapshot||snapshot.runId===prior||!this.matches(snapshot,step.id)){this.fail();return;}
      }
      if(step.id==='MEMORY')this.agent.presentationNarration("I also support long-term memory, but I only save it explicitly when requested. Memory is not authoritative evidence of current operational conditions.");
      if(step.id==='RAG')this.knowledgeBasis.set(this.agent.latest());
      this.speak(this.formatter.format(this.agent.answer(),'en').spokenResponse);this.finishStep();if(step.id==='RAG'&&this.agent.latest()?.executionTrace?.rag.diagnostics?.retrievalMode!=='HYBRID'){this.outcomes.update(o=>({...o,RAG:'WARNING'}));this.message.set('Evidence was returned, but hybrid retrieval was not observed. Inspect the actual retrieval mode before describing it.');}
    }catch{if(this.current(token))this.fail();}
    finally{if(this.current(token)){if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;this.busy.set(false);}}
  }
  private matches(s:AgentInspectorSnapshot,id:string){const t=s.executionTrace;if(!t||s.status==='FAILED')return false;
    if(id==='RAG')return s.toolsUsed.includes('search_hse_knowledge')&&s.citations.length>0&&t.rag.used&&t.rag.chunksRetrieved>0&&t.verification.status==='VERIFIED';
    if(id==='TOOL_CALLING')return t.intent?.intent==='OPERATIONAL_OVERVIEW'&&t.tools.some(x=>x.status==='COMPLETED')&&['VERIFIED','PARTIALLY_VERIFIED'].includes(t.verification.status);
    return s.toolsUsed.includes('list_actions')&&t.conversation.stateActive&&['VERIFIED','PARTIALLY_VERIFIED'].includes(t.verification.status);
  }
  private bindPending(approval:ApprovalSnapshot,project:string){
    if(approval.actionType!=='LOTO_SAFETY_EXECUTION'){this.fail('Unexpected approval resource. No decision is permitted.');return;}
    this.agent.showPresentationApproval(approval);
    const run=this.agent.latest();if(run?.approvalRequest?.approvalId===approval.approvalId&&run.threadId===approval.threadId)this.approvalRuns.set(approval.approvalId,run);
    this.inspector.demoApprovalRun.set(this.approvalRuns.get(approval.approvalId)??null);
    this.setHumanContext({demoSessionId:this.demoSessionId(),requestInstanceId:approval.threadId,approvalId:approval.approvalId,resourceId:approval.approvalId,projectId:project,status:'PENDING',decisionMadeDuringCurrentDemo:false});
    this.observeApproval();
  }
  private observeApproval(){
    if(!this.active()||this.step().id!=='HITL')return;
    const approval=this.agent.approval(),context=this.humanContext();
    if(!approval||!context||context.demoSessionId!==this.demoSessionId()||context.approvalId!==approval.approvalId||context.requestInstanceId!==approval.threadId)return;
    this.inspector.demoApproval.set(approval);this.setHumanContext({...context,status:approval.status});
    if(approval.status==='PENDING'){
      if(this.state()==='PAUSED')this.pausedState='WAITING_FOR_HUMAN';else this.state.set('WAITING_FOR_HUMAN');
      const text='This request involves a safety-critical LOTO decision. YvY cannot confirm physical isolation or authorize the work.';
      this.agent.presentationNarration(text);this.message.set('Human approval required');this.speak(text);
    }else if(context.decisionMadeDuringCurrentDemo&&['APPROVED','REJECTED'].includes(approval.status)){
      this.state.set('HITL');this.finishStep();this.message.set(`Human decision: ${approval.status}. No physical work was performed.`);
    }else if(!this.approvalBusy()){
      this.previousDecision.set(approval);this.fail('This request was resolved outside the current demo decision. Retry to request a new human decision.');
    }
  }
  async decide(decision:'approve'|'reject'){
    const context=this.humanContext(),approval=this.agent.approval();
    if(this.state()!=='WAITING_FOR_HUMAN'||this.approvalBusy()||!this.preflight()?.canApprove||!context||context.demoSessionId!==this.demoSessionId()||!approval||approval.status!=='PENDING'||approval.approvalId!==context.approvalId||approval.threadId!==context.requestInstanceId)return;
    const token=this.generation;this.approvalBusy.set(true);
    try{
      const ok=await this.agent.resolveApproval(decision);if(!this.current(token))return;
      const resolved=this.agent.approval();
      if(ok&&resolved?.approvalId===context.approvalId&&resolved.threadId===context.requestInstanceId&&resolved.status===(decision==='approve'?'APPROVED':'REJECTED')){
        this.setHumanContext({...context,status:resolved.status,decisionMadeDuringCurrentDemo:true});this.observeApproval();
      }else this.message.set('The human decision was not accepted. Check current permissions; no approval is implied.');
    }catch{if(this.current(token))this.message.set('Human decision unavailable. Retry the manual action or skip.');}
    finally{if(this.current(token))this.approvalBusy.set(false);}
  }
  private finishStep(){this.completed.set(true);this.recordOutcome('COMPLETED');this.message.set('Step completed. Continue when ready.');}
  private speak(text:string){
    if(this.state()==='PAUSED')return;
    // Same formatter/TTS pipeline; projector metadata and record identifiers are never narrated.
    const safe=text.replace(/https?:\/\/\S+|\b[A-Z]{2,12}-[A-Z0-9-]+\b|\[[^\]]+\]/g,'').replace(/[|{}]/g,' ').slice(0,1150);
    const token=this.generation;const failed=()=>{if(this.current(token)){this.voiceDegraded.set(true);if(this.state()!=='WAITING_FOR_HUMAN')this.message.set('Voice degraded. Text remains available.');}};
    const ended=()=>{if(this.current(token)&&this.voice.playback()?.effectiveEngine==='BROWSER_FALLBACK')this.voiceDegraded.set(true);};
    if(!this.voice.speak(safe,'en',ended,failed))failed();
  }
  showEvidence(){this.inspector.demoPreset.set(true);this.technical.update(v=>!v);}
}
