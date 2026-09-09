import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { AgentInspectorService, ApprovalSnapshot, AgentInspectorSnapshot } from '../../../core/agent-inspector.service';
import { environment } from '../../../../environments/environment';
import { YvyCommandCenterAgentService } from '../yvy-command-center-agent.service';
import { VoiceEngineService } from '../voice/voice-engine.service';
import { SpokenResponseFormatterService } from '../voice/spoken-response-formatter.service';
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
  private generation=0;private clock?:ReturnType<typeof setInterval>;private deadline?:ReturnType<typeof setTimeout>;private startTime=0;
  private pausedState:DemoState='IDLE';private pendingAdvance=false;private normalInspectorPreset=false;
  private controller?:AbortController;
  constructor(){let owner=this.auth.user()?.userId;effect(()=>{const current=this.auth.user()?.userId;if(current!==owner){owner=current;this.exit();this.enabled.set(false);void this.loadFlag();}},{allowSignalWrites:true});effect(()=>{const approval=this.agent.approval();if(this.active()&&this.state()==='WAITING_FOR_HUMAN'&&approval&&approval.status!=='PENDING')this.observeApproval();},{allowSignalWrites:true});}
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
    this.voice.stop();this.voiceDegraded.set(false);this.active.set(true);this.state.set('PREFLIGHT');this.message.set('Checking presentation readiness…');this.preflight.set(null);
    this.normalInspectorPreset=this.inspector.demoPreset();const token=++this.generation;this.controller=new AbortController();
    try{const result=await this.check();if(!this.current(token))return;this.preflight.set(result);this.message.set(result.operational?'Review preflight, then Continue.':'Demo operational data unavailable. Operational, memory and HITL steps can be skipped.');}
    catch{if(this.current(token))this.message.set('Preflight unavailable. Exit and check the authenticated server configuration.');}
  }
  async continue(){
    if(!this.active())return;
    if(this.state()==='PAUSED'){this.state.set(this.pausedState);if(this.pendingAdvance){this.pendingAdvance=false;await this.execute();}return;}
    if(this.busy())return;
    if(this.state()==='PREFLIGHT'){
      if(!this.preflight()||this.preflight()!.status==='BLOCKED')return;
      if(!this.agent.beginPresentation()){this.message.set('Wait for the current conversation request to finish.');return;}
      this.startTime=Date.now();this.clock=setInterval(()=>this.elapsed.set(Math.floor((Date.now()-this.startTime)/1000)),1000);await this.execute();return;
    }
    if(this.state()==='WAITING_FOR_HUMAN'){this.message.set('A manual Approve or Reject decision is required, or explicitly Skip this step.');return;}
    if(this.completed()||this.state()==='FAILED_STEP')await this.next();
  }
  pause(){if(!this.active()||this.state()==='PREFLIGHT'||this.state()==='PAUSED'||this.state()==='COMPLETED')return;this.pausedState=this.state();this.state.set('PAUSED');this.voice.stop();}
  async skip(){if(!this.active()||this.state()==='PREFLIGHT'||this.approvalBusy())return;this.cancelStep();this.outcomes.update(o=>({...o,[this.step().id]:'SKIPPED'}));await this.next();}
  async retry(){if(this.state()!=='FAILED_STEP'||this.busy())return;await this.execute();}
  restart(){if(!this.active()||this.state()==='PREFLIGHT'||this.approvalBusy())return;this.cancelStep();this.index.set(0);this.outcomes.set({});this.completed.set(false);this.state.set('PAUSED');this.pausedState='INTRODUCTION';this.pendingAdvance=true;this.elapsed.set(0);this.startTime=Date.now();this.message.set('Progress restarted. Existing human decisions are retained; no write is repeated automatically.');}
  exit(){if(!this.active())return;this.cancelStep();this.controller?.abort();this.controller=undefined;if(this.clock)clearInterval(this.clock);this.clock=undefined;this.agent.endPresentation();this.inspector.demoPreset.set(this.normalInspectorPreset);this.inspector.demoApproval.set(null);this.active.set(false);this.state.set('IDLE');this.index.set(0);this.preflight.set(null);this.outcomes.set({});this.completed.set(false);this.elapsed.set(0);this.technical.set(false);this.message.set('');this.pendingAdvance=false;}
  private cancelStep(){this.generation++;if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;this.agent.stopPresentationRequest();this.voice.stop();this.busy.set(false);}
  private current(token:number){return this.active()&&token===this.generation;}
  private async next(){if(this.index()===5){this.state.set('COMPLETED');if(this.clock)clearInterval(this.clock);return;}this.index.update(n=>n+1);await this.execute();}
  private fail(message=this.step().fallbackMessage){this.message.set(message);this.outcomes.update(o=>({...o,[this.step().id]:'FAILED'}));if(this.state()==='PAUSED')this.pausedState='FAILED_STEP';else this.state.set('FAILED_STEP');this.completed.set(false);}
  private async execute(){
    this.pendingAdvance=false;this.voice.stop();const step=this.step(),token=++this.generation;this.busy.set(true);this.completed.set(false);this.state.set(step.id);this.message.set(step.purpose);this.technical.set(false);
    this.deadline=setTimeout(()=>{if(this.current(token)){this.cancelStep();this.fail('This step timed out. Its server outcome may be pending; retry checks existing human decisions before any request.');}},step.timeoutMs);
    try{
      if(step.narration){this.agent.presentationNarration(step.narration);this.speak(step.narration);this.finishStep();return;}
      const live=await this.check();if(!this.current(token))return;this.preflight.set(live);
      if(live.status==='BLOCKED'){this.fail('Agent unavailable. Retry or skip this step.');return;}
      if(['TOOL_CALLING','MEMORY','HITL'].includes(step.id)&&!live.operational){this.fail('Demo operational data unavailable. Prepare the dedicated synthetic context or skip this step.');return;}
      if(step.id==='RAG'&&(!live.rag||!live.operational)){this.fail('Approved RAG corpus or safe demo context unavailable. No evidence is claimed.');return;}
      if(step.id==='HITL'){
        if(live.approval){this.agent.showPresentationApproval(live.approval);this.observeApproval();return;}
        if(this.readMarker()){this.fail('A previous demo approval request was dispatched. Its outcome is unresolved or unavailable. No duplicate request will be sent.');return;}
        const thread=this.agent.presentationThreadId;if(!thread||!this.storeMarker(thread)){this.fail('Unable to retain the approval request marker. No request was sent.');return;}
        const ok=await this.agent.send(`Approve LOTO ${live.project} as safe for execution.`);if(!this.current(token))return;
        if(!ok||!this.agent.approval()){this.fail('The critical request did not return an approval. Its outcome may be pending; Retry checks the server without repeating the request.');return;}
        this.observeApproval();return;
      }
      for(const prompt of step.prompts??[]){
        // Pausing never sends the next memory turn until Continue is explicitly pressed.
        while(this.current(token)&&this.state()==='PAUSED')await new Promise(r=>setTimeout(r,100));
        if(!this.current(token))return;
        const prior=this.agent.latest()?.runId,ok=await this.agent.send(prompt);if(!this.current(token))return;
        const snapshot=this.agent.latest();if(!ok||!snapshot||snapshot.runId===prior||!this.matches(snapshot,step.id)){this.fail();return;}
      }
      if(step.id==='MEMORY')this.agent.presentationNarration("I also support long-term memory, but I only save it explicitly when requested. Memory is not authoritative evidence of current operational conditions.");
      this.speak(this.formatter.format(this.agent.answer(),'en').spokenResponse);this.finishStep();if(step.id==='RAG'&&this.agent.latest()?.executionTrace?.rag.diagnostics?.retrievalMode!=='HYBRID'){this.outcomes.update(o=>({...o,RAG:'WARNING'}));this.message.set('Evidence was returned, but hybrid retrieval was not observed. Inspect the actual retrieval mode before describing it.');}
    }catch{if(this.current(token))this.fail();}
    finally{if(this.current(token)){if(this.deadline)clearTimeout(this.deadline);this.deadline=undefined;this.busy.set(false);}}
  }
  private matches(s:AgentInspectorSnapshot,id:string){const t=s.executionTrace;if(!t||s.status==='FAILED')return false;
    if(id==='RAG')return s.toolsUsed.includes('search_hse_knowledge')&&s.citations.length>0&&t.rag.used&&t.rag.chunksRetrieved>0&&t.verification.status==='VERIFIED';
    if(id==='TOOL_CALLING')return t.intent?.intent==='OPERATIONAL_OVERVIEW'&&t.tools.some(x=>x.status==='COMPLETED')&&['VERIFIED','PARTIALLY_VERIFIED'].includes(t.verification.status);
    return s.toolsUsed.includes('list_actions')&&t.conversation.stateActive&&['VERIFIED','PARTIALLY_VERIFIED'].includes(t.verification.status);
  }
  private observeApproval(){const approval=this.agent.approval();this.inspector.demoApproval.set(approval);if(!approval){this.fail();return;}if(approval.status==='PENDING'){if(this.state()==='PAUSED')this.pausedState='WAITING_FOR_HUMAN';else this.state.set('WAITING_FOR_HUMAN');const text='This request involves a safety-critical LOTO decision. I cannot authorize it by myself. Human approval is required. Digital approval does not verify equipment or physical isolation.';this.agent.presentationNarration(text);this.message.set('WAITING FOR HUMAN APPROVAL');this.speak(text);}else if(approval.status==='CANCELLED'){this.fail('The approval was cancelled. No approved decision is implied.');}else{this.state.set('HITL');this.finishStep();this.message.set(`Human decision: ${approval.status}. No physical work was performed.`);}}
  async decide(decision:'approve'|'reject'){
    if(this.state()!=='WAITING_FOR_HUMAN'||this.approvalBusy()||!this.preflight()?.canApprove)return;
    const token=this.generation;this.approvalBusy.set(true);try{const ok=await this.agent.resolveApproval(decision);if(!this.current(token))return;if(ok){this.observeApproval();this.speak(this.formatter.format(this.agent.answer(),'en').spokenResponse);}else this.message.set('The human decision was not accepted. Check current permissions; no approval is implied.');}catch{if(this.current(token))this.message.set('Human decision unavailable. Retry the manual action or skip.');}finally{this.approvalBusy.set(false);}
  }
  private finishStep(){this.completed.set(true);this.outcomes.update(o=>({...o,[this.step().id]:'COMPLETED'}));this.message.set('Step completed. Continue when ready.');}
  private speak(text:string){
    if(this.state()==='PAUSED')return;
    // Same formatter/TTS pipeline; projector metadata and record identifiers are never narrated.
    const safe=text.replace(/https?:\/\/\S+|\b[A-Z]{2,12}-[A-Z0-9-]+\b|\[[^\]]+\]/g,'').replace(/[|{}]/g,' ').slice(0,1150);
    const token=this.generation;const failed=()=>{if(this.current(token)){this.voiceDegraded.set(true);this.message.set('Voice degraded. Text remains available; Continue is enabled.');}};
    const ended=()=>{if(this.current(token)&&this.voice.playback()?.effectiveEngine==='BROWSER_FALLBACK')this.voiceDegraded.set(true);};
    if(!this.voice.speak(safe,'en',ended,failed))failed();
  }
  showEvidence(){this.inspector.demoPreset.set(true);this.technical.update(v=>!v);}
}
