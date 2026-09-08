import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VoiceEngineService, defaultVoicePreference, matchesLocale, type VoicePreference } from './voice-engine.service';

function samePreference(left: VoicePreference, right: VoicePreference) {
  return left.engine === right.engine
    && left.languageLocale === right.languageLocale
    && left.genderProfile === right.genderProfile
    && left.voiceId === right.voiceId
    && left.voiceName === right.voiceName
    && Number(left.speed) === Number(right.speed);
}

@Component({selector:'app-yvy-voice-settings',standalone:true,imports:[CommonModule,FormsModule],template:`
  <details class="settings"><summary>YvY Voice Settings</summary>
    <p>Engine: {{engine.available() && draft.engine==='ELEVENLABS' ? 'ElevenLabs' : 'Browser fallback'}}</p>
    <p *ngIf="engine.playback()?.effectiveEngine==='ELEVENLABS'">Última reprodução: ElevenLabs<span *ngIf="engine.playback()?.voiceName"> · {{engine.playback()?.voiceName}}</span>.</p>
    <p *ngIf="engine.playback()?.effectiveEngine==='BROWSER_FALLBACK'">Última reprodução: voz do navegador (fallback). Motivo: {{engine.playback()?.fallbackReason}}.</p>
    <label>Engine <select [(ngModel)]="draft.engine" (ngModelChange)="changed()"><option value="ELEVENLABS">ElevenLabs</option><option value="BROWSER">Browser</option></select></label>
    <label>Language <select [(ngModel)]="draft.languageLocale" (ngModelChange)="catalogChanged()"><option value="en">English</option><option value="pt-PT">Português — Portugal</option><option value="pt-BR">Português — Brasil</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option></select></label>
    <fieldset><legend>Voice profile</legend><button type="button" (click)="chooseProfile('FEMALE')" [attr.aria-pressed]="filter()==='FEMALE'">Feminina</button><button type="button" (click)="chooseProfile('MALE')" [attr.aria-pressed]="filter()==='MALE'">Masculina</button><button type="button" (click)="chooseProfile('ALL')" [attr.aria-pressed]="filter()==='ALL'">Todas</button></fieldset>
    <label>Voice <select [(ngModel)]="draft.voiceId" (ngModelChange)="selectVoice()"><option [ngValue]="null">Selecione uma voz</option><optgroup [label]="'Native / verified for ' + draft.languageLocale"><option *ngFor="let voice of recommendedVoices()" [ngValue]="voice.id">{{voice.name}} — {{voice.profile}} — {{voice.locale || voice.language || 'UNKNOWN'}}{{voice.accent ? ' (' + voice.accent + ')' : ''}}{{voice.category ? ' · ' + voice.category : ''}}</option></optgroup><optgroup label="Other compatible multilingual voices"><option *ngFor="let voice of fallbackVoices()" [ngValue]="voice.id">{{voice.name}} — {{voice.profile}} — {{voice.locale || voice.language || 'UNKNOWN'}}{{voice.accent ? ' (' + voice.accent + ')' : ''}}{{voice.category ? ' · ' + voice.category : ''}}</option></optgroup></select></label>
    <p *ngIf="!localeMatch()">Sotaque exato não confirmado. A voz disponível poderá usar outro sotaque.</p>
    <p *ngIf="draft.engine==='BROWSER'">O browser seleciona a voz disponível por idioma; perfil feminino/masculino não é garantido.</p>
    <label>Speed {{draft.speed}} <input type="range" min="0.7" max="1.2" step="0.05" [(ngModel)]="draft.speed" (ngModelChange)="changed()"></label>
    <button type="button" (click)="preview()" [disabled]="busy">▶ Ouvir amostra</button>
    <button type="button" (click)="stopPreview()">Parar</button>
    <button type="button" (click)="save()" [disabled]="!engine.ready() || !dirty() || saving()">{{saving() ? 'Salvando...' : 'Salvar'}}</button>
    <p role="status" [class.success]="feedbackKind()==='success'" [class.failure]="feedbackKind()==='failure'">{{feedback() || engine.error()}}</p>
  </details>`,styles:[`.settings{color:#c9e4ee;background:#092031;border:1px solid #126079;border-radius:12px;padding:12px;margin:12px 0;max-width:520px}label{display:block;margin:10px 0}select{max-width:100%;margin-left:8px}button,select{background:#123c50;color:#e0f5ff;border:1px solid #26718a;border-radius:5px;padding:6px;margin:3px}button[aria-pressed=true]{border-color:#2ce3ed}button:disabled{opacity:.55}fieldset{border:0;padding:0}p{font-size:12px}.success{color:#68efb2}.failure{color:#ff9a9a}`]})
export class VoiceSettingsComponent implements OnDestroy {
  @Input() busy=false;
  readonly engine=inject(VoiceEngineService);
  draft:VoicePreference=defaultVoicePreference();
  readonly filter=signal<'FEMALE'|'MALE'|'ALL'>('ALL');
  readonly filtered=computed(()=>this.engine.voices().filter(v=>this.filter()==='ALL'||v.profile===this.filter()));
  readonly saving=signal(false);
  readonly feedback=signal('');
  readonly feedbackKind=signal<'success'|'failure'|''>('');
  private feedbackTimer:ReturnType<typeof setTimeout>|null=null;

  constructor(){effect(()=>{const preference=this.engine.preference();this.draft={...preference};this.filter.set(preference.genderProfile==='UNKNOWN'?'ALL':preference.genderProfile);},{allowSignalWrites:true});}
  ngOnDestroy(){if(this.feedbackTimer)clearTimeout(this.feedbackTimer);}
  dirty(){return !samePreference(this.draft,this.engine.preference());}
  recommendedVoices(){return this.filtered().filter(voice=>matchesLocale(voice,this.draft.languageLocale)).sort((a,b)=>Number(b.locale===this.draft.languageLocale)-Number(a.locale===this.draft.languageLocale));}
  fallbackVoices(){return this.filtered().filter(voice=>!matchesLocale(voice,this.draft.languageLocale));}
  rankedVoices(){return [...this.recommendedVoices(),...this.fallbackVoices()];}
  changed(){this.clearFeedback();}
  catalogChanged(){this.changed();this.draft.voiceId=null;this.draft.voiceName=null;void this.engine.loadCatalog(this.draft.languageLocale,this.filter());}
  chooseProfile(profile:'FEMALE'|'MALE'|'ALL'){this.clearFeedback();this.filter.set(profile);this.draft.genderProfile=profile==='ALL'?'UNKNOWN':profile;const voice=this.engine.voices().find(v=>v.id===this.draft.voiceId);if(voice&&profile!=='ALL'&&voice.profile!==profile){this.draft.voiceId=null;this.draft.voiceName=null;}void this.engine.loadCatalog(this.draft.languageLocale,profile);}
  selectVoice(){this.clearFeedback();const voice=this.engine.voices().find(v=>v.id===this.draft.voiceId),filter=this.filter();this.draft.voiceName=voice?.name??null;this.draft.genderProfile=voice?.profile??(filter==='ALL'?'UNKNOWN':filter);}
  localeMatch(){const voice=this.engine.voices().find(v=>v.id===this.draft.voiceId);return voice?matchesLocale(voice,this.draft.languageLocale):this.engine.voices().some(v=>matchesLocale(v,this.draft.languageLocale));}
  async preview(){this.clearFeedback();if(!await this.prepareLibraryVoice())return;if(!this.engine.preview({...this.draft,speed:Number(this.draft.speed)},()=>this.showFeedback('Amostra concluída.','success'),()=>this.showFeedback('Não foi possível reproduzir a amostra.','failure')))this.showFeedback('Áudio silenciado ou indisponível.','failure');}
  stopPreview(){this.engine.stop();this.showFeedback('Amostra interrompida.','');}
  async save(){if(!this.dirty()||this.saving())return;this.clearFeedback();this.saving.set(true);if(!await this.prepareLibraryVoice()){this.saving.set(false);return;}const persisted=await this.engine.save({...this.draft,speed:Number(this.draft.speed)});this.saving.set(false);if(persisted){this.draft={...persisted};this.filter.set(persisted.genderProfile==='UNKNOWN'?'ALL':persisted.genderProfile);this.showFeedback('✓ Preferências salvas','success');}else this.showFeedback('✕ Não foi possível salvar as preferências de voz.','failure');}
  private async prepareLibraryVoice(){const voice=this.engine.voices().find(item=>item.id===this.draft.voiceId);if(!voice||voice.source!=='LIBRARY')return true;const id=await this.engine.activateVoice(voice);if(!id){this.showFeedback('✕ Não foi possível adicionar a voz selecionada.','failure');return false;}this.draft.voiceId=id;return true;}
  private showFeedback(message:string,kind:'success'|'failure'|''){this.clearFeedback();this.feedback.set(message);this.feedbackKind.set(kind);if(kind==='success')this.feedbackTimer=setTimeout(()=>{this.feedback.set('');this.feedbackKind.set('');this.feedbackTimer=null;},4000);}
  private clearFeedback(){if(this.feedbackTimer){clearTimeout(this.feedbackTimer);this.feedbackTimer=null;}this.feedback.set('');this.feedbackKind.set('');}
}
