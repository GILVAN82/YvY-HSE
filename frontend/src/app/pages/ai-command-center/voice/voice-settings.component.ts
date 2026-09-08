import { Component, Input, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoiceEngineService, defaultVoicePreference, matchesLocale, type VoicePreference } from './voice-engine.service';

@Component({selector:'app-yvy-voice-settings',standalone:true,imports:[CommonModule,FormsModule],template:`
  <details class="settings"><summary>YvY Voice Settings</summary>
    <p>Engine: {{engine.available() && draft.engine==='ELEVENLABS' ? 'ElevenLabs' : 'Browser fallback'}}</p>
    <p *ngIf="engine.playback()?.effectiveEngine==='BROWSER_FALLBACK'">Última reprodução: voz do navegador (fallback).</p>
    <label>Engine <select [(ngModel)]="draft.engine"><option value="ELEVENLABS">ElevenLabs</option><option value="BROWSER">Browser</option></select></label>
    <label>Language <select [(ngModel)]="draft.languageLocale"><option value="en">English</option><option value="pt-PT">Português — Portugal</option><option value="pt-BR">Português — Brasil</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label>
    <fieldset><legend>Voice profile</legend><button type="button" (click)="chooseProfile('FEMALE')" [attr.aria-pressed]="filter()==='FEMALE'">Feminina</button><button type="button" (click)="chooseProfile('MALE')" [attr.aria-pressed]="filter()==='MALE'">Masculina</button><button type="button" (click)="chooseProfile('ALL')" [attr.aria-pressed]="filter()==='ALL'">All</button></fieldset>
    <label>Voice <select [(ngModel)]="draft.voiceId" (ngModelChange)="selectVoice()"><option [ngValue]="null">Automática / disponível</option><option *ngFor="let voice of rankedVoices()" [ngValue]="voice.id">{{voice.name}} — {{voice.profile}} · {{voice.accent || voice.language || 'Unknown locale'}}</option></select></label>
    <p *ngIf="!localeMatch()">Sotaque exato não confirmado. A voz disponível poderá usar outro sotaque.</p>
    <p *ngIf="draft.engine==='BROWSER'">O browser seleciona a voz disponível por idioma; perfil feminino/masculino não é garantido.</p>
    <label>Speed {{draft.speed}} <input type="range" min="0.7" max="1.2" step="0.05" [(ngModel)]="draft.speed"></label>
    <button type="button" (click)="preview()" [disabled]="busy">▶ Ouvir amostra</button><button type="button" (click)="engine.stop();message='Amostra interrompida.'">Parar</button><button type="button" (click)="save()" [disabled]="!engine.ready()">Salvar</button>
    <p role="status">{{message || engine.error()}}</p>
  </details>`,styles:[`.settings{color:#c9e4ee;background:#092031;border:1px solid #126079;border-radius:12px;padding:12px;margin:12px 0;max-width:520px}label{display:block;margin:10px 0}select{max-width:100%;margin-left:8px}button,select{background:#123c50;color:#e0f5ff;border:1px solid #26718a;border-radius:5px;padding:6px;margin:3px}button[aria-pressed=true]{border-color:#2ce3ed}fieldset{border:0;padding:0}p{font-size:12px}`]})
export class VoiceSettingsComponent {
  @Input() busy=false;
  readonly engine=inject(VoiceEngineService);
  draft:VoicePreference=defaultVoicePreference();
  readonly filter=signal<'FEMALE'|'MALE'|'ALL'>('ALL');
  readonly filtered=computed(()=>this.engine.voices().filter(v=>this.filter()==='ALL'||v.profile===this.filter()));
  message='';
  constructor(){effect(()=>{this.draft={...this.engine.preference()};this.message='';});}
  rankedVoices(){const filtered=this.filtered(),matching=filtered.filter(voice=>matchesLocale(voice,this.draft.languageLocale));return matching.length?matching:filtered;}
  chooseProfile(profile:'FEMALE'|'MALE'|'ALL'){this.filter.set(profile);this.draft.genderProfile=profile==='ALL'?'UNKNOWN':profile;const voice=this.engine.voices().find(v=>v.id===this.draft.voiceId);if(voice&&profile!=='ALL'&&voice.profile!==profile){this.draft.voiceId=null;this.draft.voiceName=null;}}
  selectVoice(){const voice=this.engine.voices().find(v=>v.id===this.draft.voiceId);this.draft.voiceName=voice?.name??null;this.draft.genderProfile=voice?.profile??'UNKNOWN';}
  localeMatch(){const voice=this.engine.voices().find(v=>v.id===this.draft.voiceId);return voice?matchesLocale(voice,this.draft.languageLocale):this.engine.voices().some(v=>matchesLocale(v,this.draft.languageLocale));}
  preview(){this.message='';if(!this.engine.preview({...this.draft,speed:Number(this.draft.speed)},()=>this.message='Amostra concluída.',()=>this.message='Não foi possível reproduzir a amostra.'))this.message='Áudio silenciado ou indisponível.';}
  async save(){this.message=await this.engine.save({...this.draft,speed:Number(this.draft.speed)})?'Preferências salvas.':'Não foi possível salvar.';}
}
