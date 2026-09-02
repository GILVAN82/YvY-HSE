import { Injectable } from '@angular/core';
import type { ConversationLanguage } from './voice.types';

const locale:Record<ConversationLanguage,string>={en:'en-US',pt:'pt-BR',es:'es-ES',fr:'fr-FR',de:'de-DE'};
@Injectable({providedIn:'root'})
export class SpeechSynthesisService{
  muted=false;lastText='';lastLanguage:ConversationLanguage='en';private generation=0;
  get supported(){return typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined';}
  speak(text:string,language:ConversationLanguage,onEnd?:()=>void,onError?:()=>void){if(this.muted||!this.supported||!text.trim())return false;this.stop();this.lastText=text;this.lastLanguage=language;const token=this.generation;const chunks=this.chunk(text);const next=()=>{if(token!==this.generation)return;const part=chunks.shift();if(!part){onEnd?.();return;}const utterance=new SpeechSynthesisUtterance(part);utterance.lang=locale[language];utterance.rate=.96;utterance.pitch=1;const voices=speechSynthesis.getVoices();utterance.voice=voices.find(v=>v.lang.toLowerCase().startsWith(language))??null;utterance.onend=next;utterance.onerror=()=>{if(token===this.generation)onError?.();};speechSynthesis.speak(utterance);};next();return true;}
  stop(){this.generation++;if(this.supported)speechSynthesis.cancel();}
  replay(onEnd?:()=>void){return this.speak(this.lastText,this.lastLanguage,onEnd);}
  setMuted(value:boolean){this.muted=value;if(value)this.stop();}
  private chunk(text:string){const sentences=text.match(/[^.!?;]+[.!?;]+|[^.!?;]+$/g)?.map(value=>value.trim()).filter(Boolean)??[text];const chunks:string[]=[];for(const sentence of sentences){if(!chunks.length||chunks.at(-1)!.length+sentence.length>=220)chunks.push(sentence);else chunks[chunks.length-1]=`${chunks.at(-1)} ${sentence}`;}return chunks;}
}
