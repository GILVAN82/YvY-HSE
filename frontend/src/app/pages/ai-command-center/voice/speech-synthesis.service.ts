import { Injectable } from '@angular/core';
import type { ConversationLanguage } from './voice.types';

const locale:Record<ConversationLanguage,string>={en:'en-US',pt:'pt-BR',es:'es-ES',fr:'fr-FR',de:'de-DE'};
@Injectable({providedIn:'root'})
export class SpeechSynthesisService{
  muted=false;lastText='';lastLanguage:ConversationLanguage='en';
  get supported(){return typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined';}
  speak(text:string,language:ConversationLanguage,onEnd?:()=>void){if(this.muted||!this.supported||!text.trim())return false;this.stop();this.lastText=text;this.lastLanguage=language;const utterance=new SpeechSynthesisUtterance(text);utterance.lang=locale[language];const voices=speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang.toLowerCase().startsWith(language))??null;utterance.onend=()=>onEnd?.();utterance.onerror=()=>onEnd?.();speechSynthesis.speak(utterance);return true;}
  stop(){if(this.supported)speechSynthesis.cancel();}
  replay(onEnd?:()=>void){return this.speak(this.lastText,this.lastLanguage,onEnd);}
  setMuted(value:boolean){this.muted=value;if(value)this.stop();}
}
