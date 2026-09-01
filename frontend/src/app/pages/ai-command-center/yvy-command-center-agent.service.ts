import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AgentInspectorService, type AgentInspectorSnapshot, type ApprovalSnapshot } from '../../core/agent-inspector.service';
import { I18nService } from '../../core/i18n.service';

interface ProviderInfo { id:string; available:boolean; models:Array<{id:string}>; allowCustomModel:boolean; }
export type CommandCenterRuntimeState = 'idle'|'analysing'|'using-tool'|'streaming'|'done'|'error';

@Injectable({providedIn:'root'})
export class YvyCommandCenterAgentService {
  private readonly inspector=inject(AgentInspectorService); private readonly i18n=inject(I18nService);
  readonly runtimeState=signal<CommandCenterRuntimeState>('idle'); readonly answer=signal(''); readonly question=signal('');
  readonly error=signal(''); readonly activeTool=signal<string|null>(null); readonly approval=signal<ApprovalSnapshot|null>(null);
  readonly latest=this.inspector.latest; readonly loading=computed(()=>['analysing','using-tool','streaming'].includes(this.runtimeState()));
  private provider:ProviderInfo|null=null; private modelId=''; private threadId:string|null=null; private history:Array<{role:'user'|'assistant';content:string}>=[];

  async initialize(){
    if(this.provider) return;
    try{const response=await fetch(`${environment.apiUrl}/ai/providers`,{credentials:'include'});if(!response.ok)throw new Error();const providers=await response.json() as ProviderInfo[];this.provider=providers.find(item=>item.available)??null;this.modelId=this.provider?.models[0]?.id??'';if(!this.provider||!this.modelId)this.error.set('The AI service is not configured at this time.');}
    catch{this.error.set('Unable to verify the assistant configuration. Check the server connection.');}
  }

  async send(message:string){
    const text=message.trim();if(!text||this.loading())return false;await this.initialize();if(!this.provider||!this.modelId){this.runtimeState.set('error');return false;}
    this.question.set(text);this.answer.set('');this.error.set('');this.activeTool.set(null);this.approval.set(null);this.runtimeState.set('analysing');
    try{
      const response=await fetch(`${environment.apiUrl}/ai/chat`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:this.history,provider:this.provider.id,model:this.modelId,...(this.threadId?{threadId:this.threadId}:{}),locale:this.i18n.lang()})});
      if(!response.ok||!response.body){const body=await response.json().catch(()=>null);this.error.set(body?.error||'The query could not be completed at this time.');this.runtimeState.set('error');return false;}
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const parts=buffer.split('\n\n');buffer=parts.pop()||'';for(const part of parts){const line=part.trim();if(!line.startsWith('data:'))continue;const payload=JSON.parse(line.slice(5).trim());this.consume(payload);}}
      if(this.runtimeState()!=='error')this.runtimeState.set('done');
      if(this.answer()){this.history=[...this.history,{role:'user' as const,content:text},{role:'assistant' as const,content:this.answer()}].slice(-12);}
      return this.runtimeState()!=='error';
    }catch{this.error.set('Server connection error.');this.runtimeState.set('error');return false;}
  }

  async resolveApproval(decision:'approve'|'reject'){
    const item=this.approval();if(!item||item.status!=='PENDING')return false;
    const response=await fetch(`${environment.apiUrl}/ai/approvals/${encodeURIComponent(item.approvalId)}/${decision}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({threadId:item.threadId,locale:this.i18n.lang()})});
    const body=await response.json().catch(()=>null);if(!response.ok||!body?.approval)return false;this.approval.set(body.approval);this.inspector.recordApproval(body.approval);if(body.text)this.answer.update(value=>`${value}\n\n${body.text}`.trim());return true;
  }

  private consume(payload:any){
    if(payload.type==='tool_use'){this.activeTool.set(typeof payload.name==='string'?payload.name:null);this.runtimeState.set('using-tool');}
    else if(payload.type==='text'){this.runtimeState.set('streaming');this.answer.update(value=>value+(payload.text||''));}
    else if(payload.type==='error'){this.error.set(payload.message||'The query could not be completed at this time.');this.runtimeState.set('error');}
    else if(payload.type==='done'){this.inspector.record(payload);this.threadId=payload.threadId||payload.conversationId||this.threadId;if(payload.approvalRequest)this.approval.set(payload.approvalRequest);}
  }
}
