import { Injectable } from '@angular/core';
import type { ConversationLanguage } from './voice.types';

const locale: Record<ConversationLanguage,string> = { en:'en-US',pt:'pt-BR',es:'es-ES',fr:'fr-FR',de:'de-DE' };
@Injectable({ providedIn:'root' })
export class SpeechSynthesisService {
  muted=false;
  lastText='';
  lastLanguage:ConversationLanguage='en';
  private generation=0;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  get supported() { return typeof speechSynthesis!=='undefined' && typeof SpeechSynthesisUtterance!=='undefined'; }
  speak(text:string,language:ConversationLanguage,onEnd?:()=>void,onError?:()=>void,settings?:{locale:string;rate:number}) {
    if(this.muted || !this.supported || !text.trim()) return false;
    this.stop();
    this.lastText=text;
    this.lastLanguage=language;
    const token=this.generation;
    const chunks=this.chunk(text);
    const voices=speechSynthesis.getVoices();
    const lang=settings?.locale??locale[language];
    const voice=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase()) ?? voices.find(v=>v.lang.toLowerCase().split('-')[0]===language) ?? null;
    const next=()=> {
      if(token!==this.generation) return;
      const part=chunks.shift();
      if(!part) { this.activeUtterance=null; onEnd?.(); return; }
      const utterance=new SpeechSynthesisUtterance(part);
      this.activeUtterance=utterance;
      utterance.lang=lang;
      utterance.rate=settings?.rate??.96;
      utterance.pitch=1;
      utterance.voice=voice;
      let settled=false;
      utterance.onend=()=> { if(settled) return; settled=true; next(); };
      utterance.onerror=()=> {
        if(settled || token!==this.generation) return;
        settled=true;
        this.generation++;
        this.activeUtterance=null;
        onError?.();
      };
      speechSynthesis.speak(utterance);
    };
    next();
    return true;
  }
  stop() { this.generation++; this.activeUtterance=null; if(this.supported) speechSynthesis.cancel(); }
  replay(onEnd?:()=>void) { return this.speak(this.lastText,this.lastLanguage,onEnd); }
  setMuted(value:boolean) { this.muted=value; if(value) this.stop(); }
  private chunk(text:string) {
    const chunks:string[]=[];
    let current='';
    // Preserve every word, including IDs and decimals. Long tokens stay intact.
    for(const word of text.trim().split(/\s+/)) {
      if(current && current.length+word.length+1>220) { chunks.push(current); current=''; }
      current=current ? `${current} ${word}` : word;
      if(current.length>=120 && /[.!?;]$/.test(word)) { chunks.push(current); current=''; }
    }
    if(current) chunks.push(current);
    return chunks;
  }
}
