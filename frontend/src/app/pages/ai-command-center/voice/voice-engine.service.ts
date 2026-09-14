import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { AgentInspectorService } from '../../../core/agent-inspector.service';
import { environment } from '../../../../environments/environment';
import { SpeechSynthesisService } from './speech-synthesis.service';
import type { ConversationLanguage } from './voice.types';

export type VoiceLocale='pt-PT'|'pt-BR'|'en'|'es'|'fr'|'de';
export type VoiceResponseMode='OFF'|'VOICE_INPUT_ONLY'|'ALL_RESPONSES';
export interface VoicePreference {engine:'ELEVENLABS'|'BROWSER';languageLocale:VoiceLocale;voiceResponseMode:VoiceResponseMode;genderProfile:'FEMALE'|'MALE'|'UNKNOWN';voiceId:string|null;voiceName:string|null;speed:number}
export interface EngineVoice {id:string;name:string;language:string|null;locale?:string|null;accent:string|null;profile:'FEMALE'|'MALE'|'UNKNOWN';category:string|null;source?:'ACCOUNT'|'LIBRARY';publicOwnerId?:string|null;verifiedLocales?:string[]}
export const defaultVoicePreference=():VoicePreference=>({engine:'ELEVENLABS',languageLocale:'en',voiceResponseMode:'VOICE_INPUT_ONLY',genderProfile:'UNKNOWN',voiceId:null,voiceName:null,speed:1});
export const previewText:Record<VoiceLocale,string>={
  'pt-PT':'Olá, eu sou a YvY. Esta é a voz selecionada para as suas interações de segurança.',
  'pt-BR':'Olá, eu sou a YvY. Esta é a voz selecionada para suas interações de segurança.',
  en:'Hello, I am YvY. This is the selected voice for your safety interactions.',es:'Hola, soy YvY. Esta es la voz seleccionada para tus interacciones de seguridad.',fr:'Bonjour, je suis YvY. Voici la voix sélectionnée pour vos échanges sur la sécurité.',de:'Hallo, ich bin YvY. Dies ist die ausgewählte Stimme für Ihre Sicherheitsgespräche.',
};
export function matchesLocale(voice:EngineVoice,locale:VoiceLocale){
  const requested=locale.toLowerCase(),voiceLocale=voice.locale?.toLowerCase(),verified=voice.verifiedLocales?.map(value=>value.toLowerCase())??[];
  if(locale.startsWith('pt-'))return voiceLocale===requested||verified.includes(requested);
  return voiceLocale===requested||verified.includes(requested)||(voice.language??'').toLowerCase()===requested;
}
@Injectable({providedIn:'root'})
export class VoiceEngineService {
  private readonly auth=inject(AuthService);
  private readonly browser=inject(SpeechSynthesisService);
  private readonly inspector=inject(AgentInspectorService);
  readonly playback=this.inspector.voiceEngine;
  readonly preference=signal(defaultVoicePreference());
  readonly voices=signal<EngineVoice[]>([]);
  readonly available=signal(false);
  readonly ready=signal(false);
  readonly busy=signal(false);
  readonly speaking=signal(false);
  readonly error=signal('');
  private owner:string|null=null;
  private generation=0;
  private controller:AbortController|null=null;
  private audio:HTMLAudioElement|null=null;
  private url:string|null=null;
  private last:{text:string;language:ConversationLanguage}|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private catalogGeneration=0;
  muted=false;
  get lastText(){return this.last?.text??'';}
  get supported(){return this.available()||this.browser.supported;}
  constructor(){effect(()=>{const id=this.auth.user()?.userId??null;if(id!==this.owner){this.reset();this.owner=id;if(id)void this.load();}},{allowSignalWrites:true});}
  reset(){this.stop();this.last=null;this.browser.lastText='';this.preference.set(defaultVoicePreference());this.voices.set([]);this.available.set(false);this.ready.set(false);this.error.set('');this.inspector.voiceEngine.set(null);}
  async load(){
    const owner=this.auth.user()?.userId;if(!owner)return;
    const result=await Promise.allSettled([fetch(`${environment.apiUrl}/ai/voice/voices?locale=en`,{credentials:'include'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}),fetch(`${environment.apiUrl}/ai/voice-preferences`,{credentials:'include'}).then(async r=>{if(!r.ok)throw new Error();return r.json();})]);
    if(owner!==this.auth.user()?.userId)return;
    if(result[0].status==='fulfilled'){this.voices.set(result[0].value.voices);this.available.set(result[0].value.available);}
    if(result[1].status==='fulfilled'){this.preference.set(result[1].value);const profile=result[1].value.genderProfile==='UNKNOWN'?'ALL':result[1].value.genderProfile;void this.loadCatalog(result[1].value.languageLocale,profile);}else this.error.set('Não foi possível carregar as preferências.');
    this.ready.set(true);
  }
  async loadCatalog(locale:VoiceLocale,profile:'FEMALE'|'MALE'|'ALL'='ALL'){
    const owner=this.auth.user()?.userId;if(!owner)return;const generation=++this.catalogGeneration;const query=new URLSearchParams({locale});if(profile!=='ALL')query.set('gender',profile);
    try{const response=await fetch(`${environment.apiUrl}/ai/voice/voices?${query}`,{credentials:'include'});if(!response.ok)throw new Error();const result=await response.json();if(generation===this.catalogGeneration&&owner===this.auth.user()?.userId){this.voices.set(result.voices);this.available.set(result.available);}}catch{if(generation===this.catalogGeneration)this.error.set('Não foi possível atualizar o catálogo de vozes.');}
  }
  async activateVoice(voice:EngineVoice){if(voice.source==='ACCOUNT')return voice.id;const owner=this.auth.user()?.userId;if(!owner||!voice.publicOwnerId)return null;try{const response=await fetch(`${environment.apiUrl}/ai/voice/voices/activate`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({publicOwnerId:voice.publicOwnerId,voiceId:voice.id,voiceName:voice.name})});if(!response.ok)return null;const result=await response.json();if(owner!==this.auth.user()?.userId||typeof result.voiceId!=='string')return null;this.voices.update(items=>items.map(item=>item.id===voice.id?{...item,id:result.voiceId,source:'ACCOUNT',publicOwnerId:null}:item));return result.voiceId;}catch{return null;}}
  async save(value:VoicePreference){
    const owner=this.auth.user()?.userId;if(!owner)return null;
    try{const response=await fetch(`${environment.apiUrl}/ai/voice-preferences`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});if(!response.ok)return null;const preference:VoicePreference=await response.json();if(owner!==this.auth.user()?.userId)return null;this.preference.set(preference);return preference;}catch{return null;}
  }
  speak(text:string,language:ConversationLanguage,onEnd?:()=>void,onError?:()=>void){
    if(this.muted||!this.auth.user()||!text.trim())return false;
    this.last={text,language};return this.start(text,language,this.preference(),false,onEnd,onError);
  }
  preview(preference:VoicePreference,onEnd?:()=>void,onError?:()=>void){return this.start(previewText[preference.languageLocale],preference.languageLocale.split('-')[0] as ConversationLanguage,preference,true,onEnd,onError);}
  replay(onEnd?:()=>void){return this.last?this.speak(this.last.text,this.last.language,onEnd,()=>onEnd?.()):false;}
  setMuted(value:boolean){this.muted=value;this.browser.setMuted(value);if(value)this.stop();}
  stop(){this.generation++;this.busy.set(false);this.speaking.set(false);if(this.timer){clearTimeout(this.timer);this.timer=null;}this.controller?.abort();this.controller=null;if(this.audio){this.audio.onended=null;this.audio.onerror=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}if(this.url){URL.revokeObjectURL(this.url);this.url=null;}this.browser.stop();}
  private start(text:string,language:ConversationLanguage,preference:VoicePreference,preview:boolean,onEnd?:()=>void,onError?:()=>void){
    if(this.muted||!this.auth.user()||!text.trim())return false;
    this.stop();this.busy.set(true);const token=this.generation,owner=this.auth.user()!.userId;
    const current=()=>token===this.generation&&owner===this.auth.user()?.userId&&!this.muted;
    const locale=language==='pt'&&preference.languageLocale.startsWith('pt-')?preference.languageLocale:language;
    const record=(engine:'ELEVENLABS'|'BROWSER_FALLBACK',reason?:string)=>this.inspector.voiceEngine.set({requestedEngine:preference.engine,effectiveEngine:engine,fallbackReason:reason??null,voiceName:engine==='ELEVENLABS'?preference.voiceName:null});
    const complete=()=>{if(!current())return;this.stop();onEnd?.();};
    const failed=()=>{if(!current())return;this.stop();onError?.();};
    let usedFallback=false;
    const fallback=(reason:string)=>{if(!current()||usedFallback)return;usedFallback=true;this.speaking.set(false);if(this.audio){this.audio.onended=null;this.audio.onerror=null;this.audio.pause();this.audio=null;}if(this.url){URL.revokeObjectURL(this.url);this.url=null;}record('BROWSER_FALLBACK',reason);if(!this.browser.speak(text,language,complete,failed,{locale,rate:preference.speed,onStart:()=>{if(current())this.speaking.set(true);}}))failed();};
    if(text.length>1200||/[|{}]|```|https?:\/\//.test(text)){queueMicrotask(failed);return true;}
    if(preference.engine==='BROWSER'||!this.available()){queueMicrotask(()=>fallback(preference.engine==='BROWSER'?'USER_SELECTED':'UNAVAILABLE'));return true;}
    const voice=preference.voiceId;
    if(!voice){queueMicrotask(()=>fallback('VOICE_NOT_SELECTED'));return true;}
    const controller=new AbortController();this.controller=controller;
    const timer=setTimeout(()=>controller.abort(),30000);this.timer=timer;
    void (async()=>{
      try{
        const response=await fetch(`${environment.apiUrl}/ai/voice/synthesize`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({text,voiceId:voice,locale,speed:preference.speed,preview})});
        if(!current())return;
        if(!response.ok){const body=await response.json().catch(()=>({}));if(body.fallbackAllowed===true||[401,403,404,408,429].includes(response.status)||response.status>=500){fallback(typeof body.fallbackReason==='string'?body.fallbackReason:'SERVICE_UNAVAILABLE');return;}this.error.set('O conteúdo da fala foi rejeitado.');failed();return;}
        if(response.headers.get('content-type')?.split(';')[0]!=='audio/mpeg'){fallback('INVALID_AUDIO');return;}
        const blob=await response.blob();if(!current())return;if(!blob.size||blob.size>4*1024*1024){fallback('INVALID_AUDIO');return;}
        this.url=URL.createObjectURL(blob);const audio=new Audio(this.url);this.audio=audio;audio.onplaying=()=>{if(current())this.speaking.set(true);};audio.onpause=()=>{if(current())this.speaking.set(false);};audio.onended=complete;audio.onerror=()=>fallback('PLAYBACK_ERROR');
        record('ELEVENLABS');await audio.play();
      }catch{if(current())fallback(controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR');}
      finally{clearTimeout(timer);}
    })();return true;
  }
}
