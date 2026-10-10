import { I18nService } from '../../../core/i18n.service';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { AgentInspectorService } from '../../../core/agent-inspector.service';
import { YvyCommandCenterAgentService } from '../yvy-command-center-agent.service';

describe('Existing agent service presentation session',()=>{
  let agent:YvyCommandCenterAgentService,auth:any,inspector:AgentInspectorService;
  beforeEach(()=>{auth={user:signal<any>({userId:'one'})};TestBed.configureTestingModule({providers:[{provide:I18nService,useValue:{lang:()=> 'en'}},{provide:AuthService,useValue:auth}]});agent=TestBed.inject(YvyCommandCenterAgentService);inspector=TestBed.inject(AgentInspectorService);TestBed.flushEffects();});
  afterEach(()=>{agent.endPresentation();sessionStorage.clear();});
  it('restores normal conversation text and thread without deleting persisted records',()=>{
    agent.timeline.set([{id:'normal',role:'USER',text:'Normal conversation',status:'COMPLETE',createdAt:''}]);agent.answer.set('Normal answer');const alerts:any=[{id:'normal-alert'}];inspector.alertEvents.set(alerts);
    expect(agent.beginPresentation()).toBeTrue();const demoThread=agent.presentationThreadId;expect(demoThread).toBeTruthy();expect(agent.timeline()).toEqual([]);
    agent.presentationNarration('Institutional introduction');agent.endPresentation();expect(agent.timeline()[0].text).toBe('Normal conversation');expect(agent.answer()).toBe('Normal answer');expect(agent.presentationThreadId).toBeNull();expect(inspector.alertEvents()).toBe(alerts);
  });
  it('does not restore the previous user conversation after identity changes',()=>{agent.answer.set('Owner one');agent.beginPresentation();agent.presentationNarration('Owner one demo');auth.user.set({userId:'two'});agent.endPresentation();expect(agent.answer()).toBe('');expect(agent.timeline()).toEqual([]);expect(inspector.latest()).toBeNull();});
  it('dispatches through the real chat endpoint with no attachments or normal-page context',async()=>{
    const fetcher=spyOn(window,'fetch').and.callFake(async(input:any,options:any)=>{
      if(String(input).endsWith('/ai/providers'))return new Response(JSON.stringify([{id:'openai',available:true,models:[{id:'test-model'}]}]));
      return new Response('data: '+JSON.stringify({type:'text',text:'Actual transport response'})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
    });
    agent.beginPresentation();await agent.send('Show open actions.');const call=fetcher.calls.all().find(c=>String(c.args[0]).endsWith('/ai/chat'))!;const body=JSON.parse((call.args[1] as RequestInit).body as string);
    expect(body.message).toBe('Show open actions.');expect(body.attachmentIds).toEqual([]);expect(body.pageContext).toBe('');expect(body.locale).toBe('en');expect(body.threadId).toBe(agent.presentationThreadId);expect(agent.answer()).toBe('Actual transport response');
  });
  it('ignores late real transport completion after demo exit and preserves the normal answer',async()=>{
    let release!:(r:Response)=>void,started!:()=>void;const began=new Promise<void>(r=>started=r);
    spyOn(window,'fetch').and.callFake(async(input:any)=>{if(String(input).endsWith('/ai/providers'))return new Response(JSON.stringify([{id:'openai',available:true,models:[{id:'test-model'}]}]));started();return new Promise<Response>(r=>release=r);});
    agent.answer.set('Normal answer');agent.beginPresentation();const request=agent.send('Show open actions.');await began;agent.endPresentation();release(new Response('data: {"type":"text","text":"LATE SECRET"}\n\n'));expect(await request).toBeFalse();expect(agent.answer()).toBe('Normal answer');
  });
});
