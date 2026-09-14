import { TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TuringDemoService, DemoPreflight } from './turing-demo.service';
import { AuthService } from '../../../core/auth.service';
import { AgentInspectorService } from '../../../core/agent-inspector.service';
import { YvyCommandCenterAgentService } from '../yvy-command-center-agent.service';
import { VoiceEngineService } from '../voice/voice-engine.service';
import { TuringDemoControllerComponent } from './turing-demo-controller.component';

// Test fixtures only. Production demo never manufactures agent/tool/evidence outcomes.
const user={userId:'demo-owner',permissions:['AI_USE','HITL_APPROVE']};
const ready:DemoPreflight={status:'READY',authenticated:true,agent:true,rag:true,operational:true,routes:true,inspector:true,voice:'CONFIGURED',project:'PRJ-001',canApprove:true,approval:null};
const pending:any={approvalId:'approval-one',threadId:'11111111-1111-4111-8111-111111111111',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL',status:'PENDING'};
describe('Turing presentation sequence, not an agent',()=>{
  let demo:TuringDemoService,agent:any,voice:any,auth:any,fetcher:jasmine.Spy,inspector:AgentInspectorService;let preflight:DemoPreflight;let count:number;
  beforeEach(()=>{
    sessionStorage.clear();preflight={...ready};count=0;auth={user:signal<any>(user)};
    agent={error:signal(''),loading:signal(false),latest:signal<any>(null),approval:signal<any>(null),answer:signal('Verified details on screen.'),presentationThreadId:pending.threadId,
      selectPresentationRequestInstance:jasmine.createSpy().and.callFake((id:string)=>{agent.presentationThreadId=id;return true;}),beginPresentation:jasmine.createSpy().and.returnValue(true),endPresentation:jasmine.createSpy(),stopPresentationRequest:jasmine.createSpy(),presentationNarration:jasmine.createSpy(),showPresentationApproval:jasmine.createSpy().and.callFake((a:any)=>agent.approval.set(a)),
      resolveApproval:jasmine.createSpy().and.callFake(async(decision:string)=>{agent.approval.set({...agent.approval(),status:decision==='approve'?'APPROVED':'REJECTED'});return true;}),
      send:jasmine.createSpy().and.callFake(async(prompt:string)=>{count++;if(prompt.startsWith('Approve LOTO'))agent.approval.set(agent.presentationThreadId===pending.threadId?pending:{...pending,threadId:agent.presentationThreadId,approvalId:'new-approval'});agent.latest.set({runId:`run-${count}`,threadId:pending.threadId,status:'COMPLETED',toolsUsed:[prompt.includes('LOTO guidance')?'search_hse_knowledge':'list_actions'],citations:prompt.includes('LOTO guidance')?[{citationLabel:'Approved reference'}]:[],executionTrace:{intent:{intent:'OPERATIONAL_OVERVIEW'},tools:[{name:'list_actions',status:'COMPLETED'}],rag:{used:true,chunksRetrieved:1},conversation:{stateActive:true,messageCount:count*2},verification:{status:'VERIFIED'}}});return true;})};
    voice={stop:jasmine.createSpy(),speak:jasmine.createSpy().and.returnValue(true),playback:signal(null)};
    fetcher=spyOn(window,'fetch').and.callFake(async(input:any)=>new Response(JSON.stringify(String(input).includes('/config')?{enabled:true}:preflight),{status:200,headers:{'Content-Type':'application/json'}}));
    TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:auth},{provide:YvyCommandCenterAgentService,useValue:agent},{provide:VoiceEngineService,useValue:voice}]});
    demo=TestBed.inject(TuringDemoService);inspector=TestBed.inject(AgentInspectorService);TestBed.flushEffects();
  });
  afterEach(()=>{demo.exit();sessionStorage.clear();});
  async function start(){await demo.loadFlag();await demo.open();await demo.continue();}
  async function hitl(){await start();for(let i=0;i<4;i++)await demo.continue();}
  it('does not open or create a presentation session when feature flag is disabled',async()=>{await demo.open();expect(demo.active()).toBeFalse();expect(agent.beginPresentation).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();});
  it('hides the entry point while disabled',()=>{const f=TestBed.createComponent(TuringDemoControllerComponent);f.detectChanges();expect(f.nativeElement.querySelector('.demo-entry')).toBeNull();f.destroy();});
  it('preflight ready does not dispatch any model call',async()=>{await demo.loadFlag();await demo.open();expect(demo.preflight()?.status).toBe('READY');expect(agent.send).not.toHaveBeenCalled();});
  it('warns on unavailable safe data and blocks operational dispatch',async()=>{preflight={...ready,status:'READY_WITH_WARNINGS',operational:false,project:null};await start();await demo.continue();expect(demo.state()).toBe('FAILED_STEP');expect(demo.message()).toContain('operational data unavailable');expect(agent.send).not.toHaveBeenCalled();});
  it('blocked preflight cannot start the session',async()=>{preflight={...ready,status:'BLOCKED',agent:false};await start();expect(agent.beginPresentation).not.toHaveBeenCalled();expect(demo.state()).toBe('PREFLIGHT');});
  it('introduction and closing are labelled narration, not fabricated model runs',async()=>{await start();expect(agent.presentationNarration).toHaveBeenCalled();expect(agent.send).not.toHaveBeenCalled();demo.index.set(5);demo.completed.set(false);await (demo as any).execute();expect(agent.send).not.toHaveBeenCalled();});
  it('progresses only when Continue is requested',async()=>{await start();expect(demo.index()).toBe(0);await demo.continue();expect(demo.index()).toBe(1);expect(agent.send).toHaveBeenCalledWith('Show the current operational overview.');});
  it('pauses and resumes without replaying a completed request',async()=>{await start();demo.pause();expect(demo.state()).toBe('PAUSED');await demo.continue();expect(demo.state()).toBe('INTRODUCTION');expect(agent.send).not.toHaveBeenCalled();});
  it('skip records a skipped step, not successful evidence',async()=>{await start();await demo.skip();expect(demo.outcomes()['INTRODUCTION']).toBe('SKIPPED');expect(demo.index()).toBe(1);});
  it('agent failure is visible and Retry uses the actual agent service again',async()=>{await start();agent.send.and.resolveTo(false);await demo.continue();expect(demo.state()).toBe('FAILED_STEP');await demo.retry();expect(agent.send.calls.count()).toBe(2);});
  for(const status of ['APPROVED','REJECTED'] as const)it(`historical ${status} requires a new pending instance and a current human click`,async()=>{
    preflight={...ready,approval:{...pending,status}};await hitl();
    expect(demo.state()).toBe('WAITING_FOR_HUMAN');expect(demo.completed()).toBeFalse();
    expect(agent.selectPresentationRequestInstance).toHaveBeenCalled();expect(agent.approval().threadId).not.toBe(pending.threadId);
    expect(demo.humanContext()?.decisionMadeDuringCurrentDemo).toBeFalse();expect(demo.humanContext()?.status).toBe('PENDING');
    const f=TestBed.createComponent(TuringDemoControllerComponent);f.detectChanges();
    const buttons=Array.from(f.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.find(b=>b.textContent?.trim()==='Approve')).toBeDefined();expect(buttons.find(b=>b.textContent?.trim()==='Reject')).toBeDefined();
    expect(buttons.find(b=>b.textContent?.trim()==='Continue')?.disabled).toBeTrue();
    await demo.continue();expect(demo.index()).toBe(4);expect(demo.completed()).toBeFalse();
    await demo.decide('reject');expect(demo.completed()).toBeTrue();expect(demo.humanContext()?.decisionMadeDuringCurrentDemo).toBeTrue();
    expect(demo.message()).toContain('Human decision: REJECTED');f.destroy();
  });
  it('an externally resolved approval never substitutes for a click in this demo',async()=>{
    await hitl();agent.approval.set({...pending,status:'APPROVED'});TestBed.flushEffects();
    expect(demo.completed()).toBeFalse();expect(demo.humanContext()?.decisionMadeDuringCurrentDemo).toBeFalse();expect(demo.outcomes()['HITL']).not.toBe('COMPLETED');
  });
  it('double Approve issues one resolution and marks only its correlated success',async()=>{
    await hitl();let release!:(v:boolean)=>void;agent.resolveApproval.and.returnValue(new Promise<boolean>(r=>release=r));
    const first=demo.decide('approve');await demo.decide('approve');expect(agent.resolveApproval.calls.count()).toBe(1);
    agent.approval.set({...pending,status:'APPROVED'});release(true);await first;
    expect(demo.completed()).toBeTrue();expect(demo.humanContext()?.decisionMadeDuringCurrentDemo).toBeTrue();
  });
  it('Restart creates another demo session and a finalized decision does not complete it',async()=>{
    await hitl();await demo.decide('approve');const previousSession=demo.demoSessionId();preflight={...ready,approval:agent.approval()};
    demo.restart();expect(demo.demoSessionId()).not.toBe(previousSession);await new Promise(r=>setTimeout(r,260));demo.index.set(4);await (demo as any).execute();
    expect(demo.state()).toBe('WAITING_FOR_HUMAN');expect(demo.completed()).toBeFalse();expect(demo.humanContext()?.decisionMadeDuringCurrentDemo).toBeFalse();
  });
  it('Retry and repeated preflight reuse the same pending request without another dispatch',async()=>{
    await hitl();const calls=agent.send.calls.count();preflight={...ready,approval:agent.approval()};
    demo.state.set('FAILED_STEP');await demo.retry();expect(agent.send.calls.count()).toBe(calls);expect(demo.state()).toBe('WAITING_FOR_HUMAN');
    expect(demo.humanContext()?.approvalId).toBe(pending.approvalId);
  });
  it('Retry accepts a new successful attempt after explicit recoverable failures without resolving HITL',async()=>{
    await start();let attempt=0;
    agent.send.and.callFake(async()=>{attempt++;agent.latest.set({runId:`retry-${attempt}`,threadId:pending.threadId,status:attempt<3?'FAILED':'COMPLETED',toolsUsed:attempt<3?[]:['list_actions'],executionTrace:{intent:{intent:'OPERATIONAL_OVERVIEW'},tools:attempt<3?[]:[{status:'COMPLETED'}],verification:{status:attempt<3?'INSUFFICIENT_EVIDENCE':'VERIFIED'},observability:{error:attempt<3?{code:'MODEL_PROVIDER_UNAVAILABLE',recoverable:true}:undefined}}});return attempt>=3;});
    await demo.continue();const failed=agent.latest();expect(demo.state()).toBe('FAILED_STEP');
    await demo.retry();expect(demo.state()).toBe('FAILED_STEP');expect(attempt).toBe(2);
    await demo.retry();expect(demo.completed()).toBeTrue();expect(agent.latest().runId).not.toBe(failed.runId);expect(failed.status).toBe('FAILED');
    expect(attempt).toBe(3);expect(agent.resolveApproval).not.toHaveBeenCalled();expect(agent.beginPresentation.calls.count()).toBe(1);
  });
  it('a successful boolean without a new real snapshot cannot complete a step',async()=>{await start();agent.send.and.resolveTo(true);await demo.continue();expect(demo.state()).toBe('FAILED_STEP');expect(demo.outcomes()['TOOL_CALLING']).toBe('FAILED');});
  it('RAG missing corpus never invents citations or a tool execution',async()=>{await start();demo.index.set(2);preflight={...ready,rag:false};await (demo as any).execute();expect(agent.send).not.toHaveBeenCalled();expect(demo.state()).toBe('FAILED_STEP');});
  it('RAG requires actual citations and verified evidence',async()=>{await start();demo.index.set(2);await (demo as any).execute();expect(demo.completed()).toBeTrue();expect(agent.latest().citations.length).toBe(1);});
  it('memory uses two actual requests in the same conversation',async()=>{await start();demo.index.set(3);await (demo as any).execute();expect(agent.send.calls.allArgs()).toEqual([['Show open actions.'],['Show evidence.']]);expect(agent.beginPresentation.calls.count()).toBe(1);});
  it('HITL waits and never auto-approves; Continue cannot bypass it',async()=>{await hitl();expect(demo.state()).toBe('WAITING_FOR_HUMAN');await demo.continue();expect(agent.resolveApproval).not.toHaveBeenCalled();expect(demo.index()).toBe(4);});
  for(const decision of ['approve','reject'] as const)it(`only manual ${decision} permits continuation`,async()=>{await hitl();await demo.decide(decision);expect(agent.resolveApproval).toHaveBeenCalledOnceWith(decision);expect(demo.state()).toBe('HITL');expect(demo.completed()).toBeTrue();await demo.continue();expect(demo.index()).toBe(5);});
  it('does not resolve when the current preflight lacks approval permission',async()=>{preflight={...ready,canApprove:false};await hitl();await demo.decide('approve');expect(agent.resolveApproval).not.toHaveBeenCalled();});
  it('restart retains pending approval and does not dispatch another critical request',async()=>{await hitl();const before=agent.send.calls.count();preflight={...ready,approval:pending};demo.restart();expect(demo.state()).toBe('INTRODUCTION');await demo.continue();demo.index.set(4);await (demo as any).execute();expect(agent.send.calls.count()).toBe(before);expect(demo.state()).toBe('WAITING_FOR_HUMAN');});
  it('unknown outcome marker prevents duplicate approval dispatch after exit/re-entry',async()=>{await hitl();demo.exit();preflight={...ready,approval:null};await start();demo.index.set(4);const before=agent.send.calls.count();await (demo as any).execute();expect(agent.send.calls.count()).toBe(before);expect(demo.message()).toContain('No duplicate');});
  it('voice failure leaves text and Continue available',async()=>{voice.speak.and.returnValue(false);await start();expect(demo.voiceDegraded()).toBeTrue();expect(demo.completed()).toBeTrue();await demo.continue();expect(demo.index()).toBe(1);});
  it('Inspector preset is only a filter over existing evidence',async()=>{await start();await demo.continue();const before=agent.latest();demo.showEvidence();expect(inspector.demoPreset()).toBeTrue();expect(agent.latest()).toBe(before);demo.exit();expect(inspector.demoPreset()).toBeFalse();});
  it('exit stops voice and request, restores normal conversation without deleting records or memory',async()=>{await start();demo.exit();expect(voice.stop).toHaveBeenCalled();expect(agent.stopPresentationRequest).toHaveBeenCalled();expect(agent.endPresentation).toHaveBeenCalled();expect(demo.state()).toBe('IDLE');expect(agent.resolveApproval).not.toHaveBeenCalled();});
  it('late response after exit cannot advance or speak',async()=>{await start();let done!:(value:boolean)=>void;agent.send.and.returnValue(new Promise<boolean>(r=>done=r));const execution=demo.continue();await Promise.resolve();await Promise.resolve();demo.exit();done?.(true);await execution;expect(demo.state()).toBe('IDLE');expect(demo.outcomes()).toEqual({});});
  it('cross-user change resets demo and ignores old state',async()=>{await start();auth.user.set({...user,userId:'other'});TestBed.flushEffects();expect(demo.active()).toBeFalse();expect(agent.endPresentation).toHaveBeenCalled();});
  it('pause during a request can resume while busy without dispatching a duplicate',async()=>{await start();let release!:(v:boolean)=>void;let began!:()=>void;const started=new Promise<void>(r=>began=r);agent.send.and.callFake(()=>{began();return new Promise<boolean>(r=>release=r);});const request=demo.continue();await started;demo.pause();expect(demo.busy()).toBeTrue();await demo.continue();expect(demo.state()).toBe('TOOL_CALLING');expect(agent.send.calls.count()).toBe(1);release(false);await request;});
  it('technical identifiers never enter demo narration',async()=>{await start();(demo as any).speak('ACT-0001 PRJ-001 https://example.invalid [source 1] Full details on screen.');const text=voice.speak.calls.mostRecent().args[0];expect(text).not.toContain('ACT-0001');expect(text).not.toContain('PRJ-001');expect(text).not.toContain('https://');});
  it('elapsed clock is local and cleaned up on exit',async()=>{let now=1000,callback!:()=>void;spyOn(Date,'now').and.callFake(()=>now);spyOn(window,'setInterval').and.callFake(((fn:()=>void)=>{callback=fn;return 7;}) as any);const clear=spyOn(window,'clearInterval');await start();now=3100;callback();expect(demo.elapsed()).toBe(2);demo.exit();expect(clear).toHaveBeenCalledWith(7);expect(demo.elapsed()).toBe(0);});
  for(const index of [0,1,2,3,4])it(`Skip advances step ${index+1} without declaring it successful`,async()=>{
    await start();demo.index.set(index);demo.state.set(demo.step().id);demo.completed.set(true);agent.approval.set(null);
    const id=demo.step().id;await demo.skip();expect(demo.index()).toBe(index+1);expect(demo.outcomes()[id]).toBe('SKIPPED');expect(demo.durations()[id]).toBeGreaterThanOrEqual(0);expect(demo.notice()).toBe('Step skipped.');expect(agent.resolveApproval).not.toHaveBeenCalled();
  });
  it('separates pending application approval from Restart to Introduction',async()=>{
    await hitl();demo.elapsed.set(123);demo.technical.set(true);demo.voiceDegraded.set(true);agent.error.set('old error');const marker=sessionStorage.getItem('yvy-turing-hitl-demo-owner'),calls=agent.send.calls.count();
    demo.restart();TestBed.flushEffects();
    expect(demo.state()).toBe('INTRODUCTION');expect(demo.index()).toBe(0);expect(demo.step().title).toBe('Introduction');expect(demo.elapsed()).toBe(0);expect(demo.outcomes()).toEqual({});expect(demo.durations()).toEqual({});expect(demo.completed()).toBeFalse();expect(demo.technical()).toBeFalse();expect(demo.voiceDegraded()).toBeFalse();expect(agent.error()).toBe('');
    expect(demo.notice()).toBe('Demo restarted.');expect(agent.approval()).toBe(pending);expect(sessionStorage.getItem('yvy-turing-hitl-demo-owner')).toBe(marker);expect(agent.send.calls.count()).toBe(calls);expect(agent.resolveApproval).not.toHaveBeenCalled();
  });
  it('separates Skip to Closing from a pending human decision',async()=>{
    await hitl();await demo.skip();TestBed.flushEffects();
    expect(demo.state()).toBe('CLOSING');expect(demo.index()).toBe(5);expect(demo.outcomes()['HITL']).toBe('SKIPPED');expect(agent.approval()).toBe(pending);expect(agent.resolveApproval).not.toHaveBeenCalled();expect(demo.notice()).toBe('Step skipped. The human approval remains pending.');
  });
  for(const index of [0,2,4,5])it(`Restart resets presentation state from completed step ${index+1}`,async()=>{
    await start();demo.index.set(index);demo.state.set(demo.step().id);demo.completed.set(true);demo.elapsed.set(90);demo.outcomes.set({[demo.step().id]:'COMPLETED'});demo.restart();
    expect(demo.index()).toBe(0);expect(demo.state()).toBe('INTRODUCTION');expect(demo.outcomes()).toEqual({});expect(demo.elapsed()).toBe(0);expect(agent.endPresentation).not.toHaveBeenCalled();expect(agent.resolveApproval).not.toHaveBeenCalled();
  });
  it('returns to the same authorized approval after restarting and traversing the presentation again',async()=>{
    await hitl();preflight={...ready,approval:pending};demo.restart();await new Promise(r=>setTimeout(r,260));await demo.continue();
    for(let i=0;i<4;i++)await demo.continue();
    expect(demo.index()).toBe(4);expect(demo.state()).toBe('WAITING_FOR_HUMAN');expect(agent.showPresentationApproval).toHaveBeenCalledWith(pending);expect(agent.send.calls.allArgs().filter((args:string[])=>args[0].startsWith('Approve LOTO')).length).toBe(1);expect(agent.resolveApproval).not.toHaveBeenCalled();
  });
  it('pins an approval found by authorized preflight without creating a replacement',async()=>{
    preflight={...ready,approval:pending};await hitl();expect(sessionStorage.getItem('yvy-turing-hitl-demo-owner')).toBe(pending.threadId);expect(agent.send.calls.allArgs().some((args:string[])=>args[0].startsWith('Approve LOTO'))).toBeFalse();
  });
  it('clears speech and ignores prior voice callbacks and clock ticks after Restart',async()=>{
    let callback!:()=>void;spyOn(window,'setInterval').and.callFake(((fn:()=>void)=>{callback=fn;return 9;}) as any);spyOn(window,'clearInterval');
    await start();const oldVoice=voice.speak.calls.mostRecent().args;demo.restart();oldVoice[3]();oldVoice[2]();callback();
    expect(voice.stop).toHaveBeenCalled();expect(demo.voiceDegraded()).toBeFalse();expect(demo.state()).toBe('INTRODUCTION');expect(demo.elapsed()).toBe(0);expect(demo.notice()).toBe('Demo restarted.');
  });
  it('aborts in-flight preflight and ignores its late result after Restart',async()=>{
    await start();let release!:(r:Response)=>void,started!:()=>void;const began=new Promise<void>(r=>started=r);let signal:AbortSignal|undefined;
    fetcher.and.callFake((_url:any,options:any)=>{signal=options.signal;started();return new Promise<Response>(r=>release=r);});
    const request=demo.continue();await began;demo.restart();expect(signal?.aborted).toBeTrue();release(new Response(JSON.stringify({...ready,approval:pending})));await request;
    expect(demo.state()).toBe('INTRODUCTION');expect(demo.index()).toBe(0);expect(demo.outcomes()).toEqual({});expect(agent.send).not.toHaveBeenCalled();
  });
  it('ignores a late agent response and cannot restore Step 5 after Restart',async()=>{
    await start();demo.index.set(4);let done!:(v:boolean)=>void,started!:()=>void;const began=new Promise<void>(r=>started=r);agent.send.and.callFake(()=>{started();return new Promise<boolean>(r=>done=r);});
    const request=(demo as any).execute();await began;demo.restart();const speeches=voice.speak.calls.count();agent.approval.set(pending);done(true);await request;TestBed.flushEffects();
    expect(demo.index()).toBe(0);expect(demo.state()).toBe('INTRODUCTION');expect(demo.outcomes()).toEqual({});expect(voice.speak.calls.count()).toBe(speeches);expect(agent.approval().status).toBe('PENDING');
  });
  it('Restart is not blocked by an in-flight manual decision and ignores its presentation callback',async()=>{
    await hitl();let done!:(v:boolean)=>void;agent.resolveApproval.and.returnValue(new Promise<boolean>(r=>done=r));const request=demo.decide('approve');expect(demo.approvalBusy()).toBeTrue();demo.restart();done(true);await request;
    expect(demo.state()).toBe('INTRODUCTION');expect(demo.index()).toBe(0);expect(agent.resolveApproval.calls.count()).toBe(1);expect(agent.approval().status).toBe('PENDING');
  });
  it('prevents duplicate navigation clicks and renders the reset progress, cue and feedback',async()=>{
    await hitl();const fixture=TestBed.createComponent(TuringDemoControllerComponent);fixture.detectChanges();const button=(name:string)=>Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.trim()===name) as HTMLButtonElement;
    button('Restart').click();fixture.detectChanges();expect(button('Restart').disabled).toBeTrue();expect(button('Skip').disabled).toBeTrue();expect(fixture.nativeElement.textContent).toContain('Step 1 of 6');expect(fixture.nativeElement.textContent).toContain('00:00');expect(fixture.nativeElement.textContent).toContain('Demo restarted.');expect(fixture.nativeElement.querySelector('[aria-current="step"]').textContent).toContain('Introduction');expect(fixture.nativeElement.textContent).toContain(demo.steps[0].cue);
    await demo.skip();expect(demo.index()).toBe(0);fixture.destroy();
  });
});
