import { Injectable } from '@angular/core';
import { detectConversationLanguage, requestedResponseLanguage } from './language-resolution';
import type { VoiceTranscriptResult } from './voice.types';

type RecognitionLike={continuous:boolean;interimResults:boolean;lang:string;start():void;stop():void;abort():void;onresult:((event:any)=>void)|null;onerror:((event:any)=>void)|null;onend:(()=>void)|null};

@Injectable({providedIn:'root'})
export class SpeechRecognitionService{
  private recognition:RecognitionLike|null=null;private settle:((value:VoiceTranscriptResult)=>void)|null=null;private fail:((reason:Error)=>void)|null=null;
  get supported(){const w=globalThis as any;return Boolean(w.SpeechRecognition||w.webkitSpeechRecognition);}
  async listen():Promise<VoiceTranscriptResult>{
    if(!this.supported)throw new Error('STT_UNAVAILABLE');
    if(navigator.mediaDevices?.getUserMedia){const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(track=>track.stop());}
    const Constructor=(globalThis as any).SpeechRecognition||(globalThis as any).webkitSpeechRecognition;const recognition:RecognitionLike=new Constructor();this.recognition=recognition;
    recognition.continuous=false;recognition.interimResults=false;recognition.lang='';
    return new Promise((resolve,reject)=>{this.settle=resolve;this.fail=reject;this.recognition!.onresult=(event:any)=>{const item=event.results[event.results.length-1][0];const transcript=String(item.transcript??'').trim();if(!transcript){reject(new Error('NO_SPEECH'));return;}const detectedLanguage=detectConversationLanguage(transcript,navigator.language);resolve({transcript,detectedLanguage,languageConfidence:typeof item.confidence==='number'?item.confidence:undefined});this.cleanup();};this.recognition!.onerror=(event:any)=>{reject(new Error(event.error==='not-allowed'?'PERMISSION_DENIED':event.error==='no-speech'?'NO_SPEECH':'STT_FAILED'));this.cleanup();};this.recognition!.onend=()=>{if(this.fail){reject(new Error('NO_SPEECH'));this.cleanup();}};this.recognition!.start();});
  }
  stop(){this.recognition?.stop();}
  cancel(){this.recognition?.abort();this.fail?.(new Error('CANCELLED'));this.cleanup();}
  resolveMetadata(result:VoiceTranscriptResult){const requested=requestedResponseLanguage(result.transcript);return {...result,inputMode:'voice' as const,requestedResponseLanguage:requested,effectiveResponseLanguage:requested??result.detectedLanguage};}
  private cleanup(){if(this.recognition){this.recognition.onresult=null;this.recognition.onerror=null;this.recognition.onend=null;}this.recognition=null;this.settle=null;this.fail=null;}
}
