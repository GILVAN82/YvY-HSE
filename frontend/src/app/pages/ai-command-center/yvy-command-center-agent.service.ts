import { AuthService } from '../../core/auth.service';
import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AgentInspectorService, type AgentInspectorSnapshot, type ApprovalSnapshot } from '../../core/agent-inspector.service';
import { I18nService } from '../../core/i18n.service';
import type { VoiceTurnMetadata } from './voice/voice.types';
import { YvyAlertService, type YvyAlert } from './yvy-alert.service';

interface ProviderInfo { id:string; available:boolean; models:Array<{id:string}>; allowCustomModel:boolean; }
export type CommandCenterRuntimeState = 'idle'|'analysing'|'using-tool'|'streaming'|'done'|'error';
export interface ConversationItem {id:string;role:'USER'|'YVY'|'SYSTEM';text:string;status:'STREAMING'|'COMPLETE'|'ERROR';inputMode?:'TEXT'|'VOICE';language?:string;snapshot?:AgentInspectorSnapshot;evidenceOpen?:boolean;createdAt:string;}

@Injectable({providedIn:'root'})
export class YvyCommandCenterAgentService {
  private readonly attention=inject(YvyAlertService);private readonly inspector=inject(AgentInspectorService);private readonly i18n=inject(I18nService);
  readonly runtimeState=signal<CommandCenterRuntimeState>('idle');readonly answer=signal('');readonly question=signal('');readonly error=signal('');readonly activeTool=signal<string|null>(null);readonly approval=signal<ApprovalSnapshot|null>(null);readonly voiceMetadata=signal<VoiceTurnMetadata|null>(null);readonly activeAlertContext=signal<YvyAlert[]>([]);readonly timeline=signal<ConversationItem[]>([]);
  readonly latest=this.inspector.latest;readonly loading=computed(()=>['analysing','using-tool','streaming'].includes(this.runtimeState()));
  private provider:ProviderInfo|null=null;private modelId='';private threadId:string|null=null;private history:Array<{role:'user'|'assistant';content:string}>=[];


  readonly presentationActive=signal(false);
  private readonly presentationAuth=inject(AuthService);
  private presentationGeneration=0;
  private presentationController:AbortController|null=null;
  private presentationRestore:(()=>void)|null=null;
  beginPresentation(threadId?:string){
    if(this.loading()||this.presentationActive())return false;
    const owner=this.presentationAuth.user()?.userId;if(!owner)return false;
    const saved={threadId:this.threadId,history:this.history,timeline:this.timeline(),answer:this.answer(),question:this.question(),error:this.error(),approval:this.approval(),runtime:this.runtimeState(),alerts:this.activeAlertContext(),voice:this.voiceMetadata(),snapshot:this.inspector.latest()};
    this.presentationRestore=()=>{if(owner!==this.presentationAuth.user()?.userId){this.threadId=null;this.history=[];this.timeline.set([]);this.question.set('');this.answer.set('');this.error.set('');this.approval.set(null);this.runtimeState.set('idle');this.inspector.clear();return;}this.threadId=saved.threadId;this.history=saved.history;this.timeline.set(saved.timeline);this.answer.set(saved.answer);this.question.set(saved.question);this.error.set(saved.error);this.approval.set(saved.approval);this.runtimeState.set(saved.runtime);this.activeAlertContext.set(saved.alerts);this.voiceMetadata.set(saved.voice);if(saved.snapshot)this.inspector.record(saved.snapshot);else this.inspector.clearRun();};
    this.threadId=threadId??crypto.randomUUID();this.history=[];this.timeline.set([]);this.answer.set('');this.question.set('');this.error.set('');this.approval.set(null);this.activeAlertContext.set([]);this.voiceMetadata.set(null);this.inspector.clearRun();this.runtimeState.set('idle');this.presentationActive.set(true);return true;
  }
  get presentationThreadId(){return this.presentationActive()?this.threadId:null;}
  /** A new request instance never inherits a finalized decision's conversation. */
  selectPresentationRequestInstance(threadId:string){
    if(!this.presentationActive()||this.loading()||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(threadId))return false;
    this.threadId=threadId;this.history=[];this.approval.set(null);this.activeAlertContext.set([]);return true;
  }
  stopPresentationRequest(){this.presentationGeneration++;this.presentationController?.abort();this.presentationController=null;if(this.presentationActive()&&this.loading()){this.runtimeState.set('error');this.error.set('Presentation request interrupted; the server outcome may still be pending.');this.finishTimeline('ERROR');}}
  endPresentation(){this.stopPresentationRequest();this.presentationActive.set(false);this.presentationRestore?.();this.presentationRestore=null;}
  presentationNarration(text:string){if(this.presentationActive())this.timeline.update(items=>[...items,{id:crypto.randomUUID(),role:'SYSTEM',text,status:'COMPLETE',createdAt:new Date().toISOString()}]);}
  showPresentationApproval(approval:ApprovalSnapshot){if(!this.presentationActive())return;this.threadId=approval.threadId;this.approval.set(approval);}
  private presentationRequestOptions(){return this.presentationActive()?{signal:this.presentationController?.signal}:{};}
  private presentationBody(){return this.presentationActive()?{locale:'en',attachmentIds:[],pageContext:'',threadId:this.threadId}:{};}

  async initialize(){if(this.provider)return;try{const response=await fetch(`${environment.apiUrl}/ai/providers`,{credentials:'include'});if(!response.ok)throw new Error();const providers=await response.json() as ProviderInfo[];this.provider=providers.find(item=>item.available)??null;this.modelId=this.provider?.models[0]?.id??'';if(!this.provider||!this.modelId)this.error.set('The AI service is not configured at this time.');}catch{this.error.set('Unable to verify the assistant configuration. Check the server connection.');}}
  resetSession(){this.threadId=null;this.history=[];this.timeline.set([]);this.question.set('');this.answer.set('');this.error.set('');this.activeTool.set(null);this.approval.set(null);this.voiceMetadata.set(null);this.activeAlertContext.set([]);this.runtimeState.set('idle');}

  async send(message:string,voiceMetadata?:VoiceTurnMetadata,pageContext?:string,attentionAlertId?:string){
    const demo=this.presentationActive(),demoGeneration=this.presentationGeneration,demoOwner=this.presentationAuth.user()?.userId;const demoCurrent=()=>!demo||(this.presentationActive()&&demoGeneration===this.presentationGeneration&&demoOwner===this.presentationAuth.user()?.userId);if(demo)this.presentationController=new AbortController();
    const text=message.trim();if(!text||this.loading())return false;this.runtimeState.set('analysing');if(!attentionAlertId)await this.initialize();if(!demoCurrent())return false;if(!attentionAlertId&&(!this.provider||!this.modelId)){this.runtimeState.set('error');return false;}
    const now=new Date().toISOString(),turn=`turn-${Date.now()}-${Math.random().toString(16).slice(2)}`;this.timeline.update(items=>[...items,{id:`${turn}-user`,role:'USER',text,status:'COMPLETE',inputMode:voiceMetadata?'VOICE':'TEXT',language:voiceMetadata?.effectiveResponseLanguage,createdAt:now},{id:`${turn}-yvy`,role:'YVY',text:'',status:'STREAMING',inputMode:voiceMetadata?'VOICE':'TEXT',language:voiceMetadata?.effectiveResponseLanguage,createdAt:now}]);
    this.question.set(text);this.voiceMetadata.set(voiceMetadata??null);this.answer.set('');this.error.set('');this.activeTool.set(null);this.approval.set(null);this.runtimeState.set('analysing');
    try{
      const response=await fetch(`${environment.apiUrl}/ai/chat`,{...this.presentationRequestOptions(),method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,attentionAlertId,history:this.history,provider:this.provider?.id??'attention',model:this.modelId||'read-only',...(this.threadId?{threadId:this.threadId}:{}),locale:voiceMetadata?.effectiveResponseLanguage??this.i18n.lang(),...(voiceMetadata?{voiceMetadata}:{}),...this.presentationBody()})});
      if(!demoCurrent())return false;if(!response.ok||!response.body){const body=await response.json().catch(()=>null);this.error.set(body?.error||'The query could not be completed at this time.');this.runtimeState.set('error');this.finishTimeline('ERROR');return false;}
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';while(true){const {done,value}=await reader.read();if(!demoCurrent())return false;if(done)break;buffer+=decoder.decode(value,{stream:true});const parts=buffer.split('\n\n');buffer=parts.pop()||'';for(const part of parts){const line=part.trim();if(line.startsWith('data:'))this.consume(JSON.parse(line.slice(5).trim()));}}
      if(this.runtimeState()!=='error')this.runtimeState.set('done');if(this.answer())this.history=[...this.history,{role:'user' as const,content:text},{role:'assistant' as const,content:this.answer()}].slice(-12);return this.runtimeState()!=='error';
    }catch{if(!demoCurrent())return false;this.error.set('Server connection error.');this.runtimeState.set('error');this.finishTimeline('ERROR');return false;}
  }
  setActiveAlertContext(alerts:YvyAlert[]){this.activeAlertContext.set(alerts.slice(0,10).map(a=>({...a,evidence:a.evidence.slice(0,5)})));}
  async resolveApproval(decision:'approve'|'reject'){const owner=this.presentationAuth.user()?.userId,generation=this.presentationGeneration;const item=this.approval();if(!item||item.status!=='PENDING')return false;const response=await fetch(`${environment.apiUrl}/ai/approvals/${encodeURIComponent(item.approvalId)}/${decision}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({threadId:item.threadId,locale:this.i18n.lang()})});const body=await response.json().catch(()=>null);if(owner!==this.presentationAuth.user()?.userId||generation!==this.presentationGeneration||!response.ok||!body?.approval)return false;this.approval.set(body.approval);this.attention.applyApprovalStatus(body.approval.approvalId,body.approval.status);this.timeline.update(items=>items.map(item=>item.snapshot && item.snapshot.approvalRequest?.approvalId===body.approval.approvalId&&item.snapshot.approvalRequest?.threadId===body.approval.threadId?{...item,snapshot:{...item.snapshot,approvalRequest:body.approval,attention:item.snapshot.attention?{...item.snapshot.attention,status:body.approval.status,decisionRequired:false}:undefined,responseStatus:body.approval.status}}:item));this.inspector.recordApproval(body.approval);if(body.text){this.answer.update(value=>`${value}\n\n${body.text}`.trim());this.updateTimelineText(`\n\n${body.text}`);}return true;}
  toggleEvidence(id:string){this.timeline.update(items=>items.map(item=>item.id===id?{...item,evidenceOpen:!item.evidenceOpen}:item));}
  private consume(payload:any){if(payload.type==='tool_use'){this.activeTool.set(typeof payload.name==='string'?payload.name:null);this.runtimeState.set('using-tool');}else if(payload.type==='text'){this.runtimeState.set('streaming');this.answer.update(value=>value+(payload.text||''));this.updateTimelineText(payload.text||'');}else if(payload.type==='error'){this.error.set(payload.message||'The query could not be completed at this time.');this.runtimeState.set('error');this.finishTimeline('ERROR');}else if(payload.type==='done'){this.inspector.record(payload);this.threadId=payload.threadId||payload.conversationId||this.threadId;if(payload.approvalRequest)this.approval.set(payload.approvalRequest);this.finishTimeline(this.runtimeState()==='error'?'ERROR':'COMPLETE',payload);}}
  private updateTimelineText(chunk:string){this.timeline.update(items=>items.map((item,index)=>index===items.length-1&&item.role==='YVY'?{...item,text:item.text+chunk,status:'STREAMING'}:item));}
  private finishTimeline(status:'COMPLETE'|'ERROR',snapshot?:AgentInspectorSnapshot){this.timeline.update(items=>items.map((item,index)=>index===items.length-1&&item.role==='YVY'?{...item,text:item.text||(status==='ERROR'?this.error():'No response was returned.'),status,snapshot:snapshot??item.snapshot}:item));}
}
