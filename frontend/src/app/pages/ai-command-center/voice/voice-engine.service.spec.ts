import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { AgentInspectorService } from '../../../core/agent-inspector.service';
import { SpeechSynthesisService } from './speech-synthesis.service';
import { VoiceEngineService, defaultVoicePreference, matchesLocale } from './voice-engine.service';
import { VoiceSettingsComponent } from './voice-settings.component';

describe('YvY voice engine',()=>{
  const voices=[{id:'female',name:'Female',profile:'FEMALE',language:'pt',accent:'brazilian',category:'premade'},{id:'male',name:'Male',profile:'MALE',language:'pt',accent:'portugal',category:'premade'},{id:'unknown',name:'Unknown',profile:'UNKNOWN',language:null,accent:null,category:null}];
  let engine:VoiceEngineService;let browser:jasmine.SpyObj<SpeechSynthesisService>;let fetchSpy:jasmine.Spy;let user:ReturnType<typeof signal<any>>;
  beforeEach(fakeAsync(()=>{
    user=signal<any>({userId:'A'});browser=jasmine.createSpyObj('browser',['speak','stop','setMuted'],{supported:true});browser.speak.and.returnValue(true);
    fetchSpy=spyOn(window,'fetch').and.callFake(async(url:any,init?:RequestInit)=>init?.method==='PUT'?({ok:true,json:()=>Promise.resolve(JSON.parse(init.body as string))} as Response):String(url).includes('/voice/voices')?({ok:true,json:()=>Promise.resolve({available:true,voices})} as Response):String(url).endsWith('/voice-preferences')?({ok:true,json:()=>Promise.resolve(defaultVoicePreference())} as Response):({ok:true,headers:new Headers({'content-type':'audio/mpeg'}),blob:()=>Promise.resolve(new Blob(['audio']))} as Response));
    TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{user}},{provide:SpeechSynthesisService,useValue:browser}]});
    engine=TestBed.inject(VoiceEngineService);TestBed.flushEffects();flushMicrotasks();
  }));
  afterEach(()=>engine.stop());
  it('loads real catalog and save/load preferences',fakeAsync(()=>{
    flushMicrotasks();expect(engine.preference().languageLocale).toBe('en');expect(engine.preference().voiceId).toBeNull();expect(engine.voices().length).toBe(3);expect(engine.available()).toBeTrue();
    let saved=null as ReturnType<typeof defaultVoicePreference>|null;engine.save({...defaultVoicePreference(),engine:'BROWSER'}).then(value=>saved=value);flushMicrotasks();expect(saved?.engine).toBe('BROWSER');
    expect(fetchSpy.calls.mostRecent().args[1].credentials).toBe('include');
  }));
  it('filters female, male and unknown without inventing metadata',fakeAsync(()=>{
    flushMicrotasks();const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();
    fixture.componentInstance.filter.set('FEMALE');expect(fixture.componentInstance.filtered().map(v=>v.id)).toEqual(['female']);
    fixture.componentInstance.filter.set('MALE');expect(fixture.componentInstance.filtered().map(v=>v.id)).toEqual(['male']);
    fixture.componentInstance.filter.set('ALL');expect(fixture.componentInstance.filtered().map(v=>v.id)).toContain('unknown');
    const options=Array.from(fixture.nativeElement.querySelectorAll('select')[1].options).map((option:any)=>option.textContent.trim());expect(options[0]).toBe('English');expect(options.slice(1)).toEqual(['Português — Portugal','Português — Brasil','Español','Français','Deutsch']);
    fixture.destroy();
  }));
  it('preserves persisted PT-PT and PT-BR preferences',fakeAsync(()=>{
    for(const languageLocale of ['pt-PT','pt-BR'] as const){engine.preference.set({...defaultVoicePreference(),languageLocale});expect(engine.preference().languageLocale).toBe(languageLocale);}
  }));
  it('distinguishes PT-PT from PT-BR metadata',fakeAsync(()=>{
    flushMicrotasks();const brazil={...engine.voices()[0],locale:'pt-BR',verifiedLocales:['pt-BR']},portugal={...engine.voices()[1],locale:'pt-PT',verifiedLocales:['pt-PT']};expect(matchesLocale(brazil,'pt-BR')).toBeTrue();expect(matchesLocale(brazil,'pt-PT')).toBeFalse();expect(matchesLocale(portugal,'pt-PT')).toBeTrue();expect(matchesLocale(engine.voices()[0],'pt-BR')).toBeFalse();expect(matchesLocale(engine.voices()[2],'pt-PT')).toBeFalse();
    expect(matchesLocale({id:'en-f',name:'English Female',profile:'FEMALE',language:'en',accent:null,category:null},'en')).toBeTrue();
    expect(matchesLocale({id:'en-m',name:'English Male',profile:'MALE',language:'en',accent:null,category:null},'en')).toBeTrue();
  }));
  it('prioritizes exact native voices for all supported discovery languages',fakeAsync(()=>{
    flushMicrotasks();const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();const component=fixture.componentInstance;
    for(const [locale,profile] of [['pt-PT','FEMALE'],['pt-BR','FEMALE'],['es','MALE'],['fr','FEMALE'],['de','MALE']] as const){engine.voices.set([{id:'fallback',name:'English',profile,language:'en',accent:'american',category:'premade'},{id:'native',name:'Native',profile,language:locale.split('-')[0],locale,verifiedLocales:[locale],accent:null,category:'professional',source:'LIBRARY',publicOwnerId:'owner'}]);component.draft.languageLocale=locale;component.filter.set(profile);expect(component.rankedVoices().map(v=>v.id)).toEqual(['native']);}
    engine.voices.set([{id:'wrong-pt',name:'Wrong Portuguese locale',profile:'FEMALE',language:'pt',locale:'pt-PT',verifiedLocales:['pt-PT'],accent:'european',category:'professional'}]);component.draft.languageLocale='pt-BR';component.filter.set('FEMALE');expect(component.rankedVoices()).toEqual([]);fixture.destroy();
  }));
  it('refreshes discovery when language and profile change',fakeAsync(()=>{
    flushMicrotasks();fetchSpy.calls.reset();const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();const component=fixture.componentInstance;component.draft.languageLocale='fr';component.catalogChanged();flushMicrotasks();expect(String(fetchSpy.calls.mostRecent().args[0])).toContain('locale=fr');component.chooseProfile('FEMALE');flushMicrotasks();expect(String(fetchSpy.calls.mostRecent().args[0])).toContain('gender=FEMALE');fixture.destroy();
  }));
  it('activates only the selected library voice before saving its id',fakeAsync(()=>{
    flushMicrotasks();const library={id:'shared',name:'Shared',profile:'FEMALE' as const,language:'pt',locale:'pt-PT',accent:'portuguese',category:'professional',source:'LIBRARY' as const,publicOwnerId:'owner',verifiedLocales:['pt-PT']};engine.voices.set([library]);fetchSpy.and.callFake(async(url:any,init?:RequestInit)=>String(url).endsWith('/activate')?({ok:true,json:()=>Promise.resolve({voiceId:'added'})} as Response):init?.method==='PUT'?({ok:true,json:()=>Promise.resolve({...defaultVoicePreference(),voiceId:'added',voiceName:'Shared',genderProfile:'FEMALE'})} as Response):({ok:true,json:()=>Promise.resolve({available:true,voices:[library]})} as Response));
    const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();const component=fixture.componentInstance;component.draft={...defaultVoicePreference(),voiceId:'shared',voiceName:'Shared',genderProfile:'FEMALE'};void component.save();flushMicrotasks();const calls=fetchSpy.calls.all();expect(calls.filter(call=>String(call.args[0]).endsWith('/activate')).length).toBe(1);const put=calls.find(call=>call.args[1]?.method==='PUT')!;expect(JSON.parse(put.args[1].body as string).voiceId).toBe('added');fixture.destroy();
  }));
  it('does not choose or save an arbitrary ElevenLabs voice',fakeAsync(()=>{
    flushMicrotasks();fetchSpy.calls.reset();engine.speak('Ready.','en');flushMicrotasks();
    expect(fetchSpy).not.toHaveBeenCalled();expect(browser.speak).toHaveBeenCalledTimes(1);expect(engine.preference().voiceId).toBeNull();expect(TestBed.inject(AgentInspectorService).voiceEngine()?.fallbackReason).toBe('VOICE_NOT_SELECTED');
  }));
  it('plays ElevenLabs audio and records the effective engine only once',fakeAsync(()=>{
    flushMicrotasks();let audio:HTMLMediaElement|undefined;
    spyOn(HTMLMediaElement.prototype,'play').and.callFake(function(this:HTMLMediaElement){audio=this;return Promise.resolve();});
    const end=jasmine.createSpy('end');engine.preference.set({...defaultVoicePreference(),voiceId:'male'});engine.speak('Olá.','pt',end);flushMicrotasks();
    expect(audio).toBeDefined();expect(end).not.toHaveBeenCalled();expect(TestBed.inject(AgentInspectorService).voiceEngine()).toEqual({requestedEngine:'ELEVENLABS',effectiveEngine:'ELEVENLABS',fallbackReason:null,voiceName:null});
    audio!.onended!(new Event('ended'));expect(end).toHaveBeenCalledTimes(1);
  }));
  it('falls back once for technical failure and preserves locale and speed',fakeAsync(()=>{
    flushMicrotasks();fetchSpy.and.resolveTo(({ok:false,status:503,json:()=>Promise.resolve({fallbackAllowed:true,fallbackReason:'UPSTREAM_429'})} as Response));
    engine.preference.set({...defaultVoicePreference(),languageLocale:'pt-PT',voiceId:'male',speed:.8});engine.speak('Olá.','pt');flushMicrotasks();
    expect(browser.speak).toHaveBeenCalledTimes(1);expect(browser.speak.calls.mostRecent().args[4]).toEqual({locale:'pt-PT',rate:.8,onStart:jasmine.any(Function)});expect(TestBed.inject(AgentInspectorService).voiceEngine()?.fallbackReason).toBe('UPSTREAM_429');
  }));
  it('does not fallback for content rejection or send visual tables',fakeAsync(()=>{
    flushMicrotasks();engine.preference.set({...defaultVoicePreference(),voiceId:'male'});fetchSpy.and.resolveTo(({ok:false,status:422,json:()=>Promise.resolve({fallbackAllowed:false})} as Response));
    const failed=jasmine.createSpy('failed');engine.speak('Resumo.','pt',undefined,failed);flushMicrotasks();expect(browser.speak).not.toHaveBeenCalled();expect(failed).toHaveBeenCalledTimes(1);
    fetchSpy.calls.reset();engine.speak('| ID | Action |','pt',undefined,failed);flushMicrotasks();expect(fetchSpy).not.toHaveBeenCalled();
  }));
  it('animates only after browser playback starts and stops on completion or mute',fakeAsync(()=>{
    flushMicrotasks();engine.available.set(false);engine.speak('Verified summary.','en');flushMicrotasks();
    const args=browser.speak.calls.mostRecent().args;expect(engine.speaking()).toBeFalse();args[4]!.onStart!();expect(engine.speaking()).toBeTrue();args[2]!();expect(engine.speaking()).toBeFalse();
    args[4]!.onStart!();expect(engine.speaking()).toBeFalse();
  }));
  it('mute prevents requests, previews and audio',fakeAsync(()=>{
    flushMicrotasks();fetchSpy.calls.reset();engine.setMuted(true);expect(engine.speak('Olá.','pt')).toBeFalse();expect(engine.preview(defaultVoicePreference())).toBeFalse();expect(fetchSpy).not.toHaveBeenCalled();expect(browser.setMuted).toHaveBeenCalledWith(true);
  }));
  it('preview uses draft preferences without changing normal replay',fakeAsync(()=>{
    flushMicrotasks();engine.available.set(false);engine.speak('Resposta verificada.','pt');flushMicrotasks();
    const draft={...defaultVoicePreference(),engine:'BROWSER' as const,languageLocale:'pt-BR' as const,speed:1.2};engine.preview(draft);flushMicrotasks();
    expect(browser.speak.calls.mostRecent().args[0]).toContain('para suas interações');expect(browser.speak.calls.mostRecent().args[4]).toEqual({locale:'pt-BR',rate:1.2,onStart:jasmine.any(Function)});
    engine.preference.set({...defaultVoicePreference(),speed:.9});engine.replay();flushMicrotasks();expect(browser.speak.calls.mostRecent().args[0]).toBe('Resposta verificada.');expect(browser.speak.calls.mostRecent().args[4]?.rate).toBe(.9);
  }));
  it('persists every draft field, confirms success and becomes clean',fakeAsync(()=>{
    const persisted={engine:'ELEVENLABS' as const,languageLocale:'pt-BR' as const,voiceResponseMode:'ALL_RESPONSES' as const,genderProfile:'FEMALE' as const,voiceId:'female',voiceName:'Female',speed:.85};
    fetchSpy.and.callFake(async(url:any,init?:RequestInit)=>init?.method==='PUT'?({ok:true,json:()=>Promise.resolve(persisted)} as Response):String(url).includes('/voice/voices')?({ok:true,json:()=>Promise.resolve({available:true,voices})} as Response):({ok:true,json:()=>Promise.resolve(defaultVoicePreference())} as Response));
    const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();const component=fixture.componentInstance;component.panelOpen.set(true);
    component.draft={...persisted};expect(component.dirty()).toBeTrue();void component.save();expect(component.saving()).toBeTrue();flushMicrotasks();fixture.detectChanges();
    const put=fetchSpy.calls.all().find(call=>call.args[1]?.method==='PUT');expect(JSON.parse(put!.args[1].body as string)).toEqual(persisted);
    expect(component.feedback()).toBe('✓ Preferências salvas');expect(component.dirty()).toBeFalse();expect(engine.preference()).toEqual(persisted);expect(component.panelOpen()).toBeTrue();
    tick(800);expect(component.panelOpen()).toBeFalse();tick(3200);expect(component.feedback()).toBe('');fixture.destroy();
  }));
  it('closes voice settings manually without saving',fakeAsync(()=>{
    const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();const component=fixture.componentInstance;component.panelOpen.set(true);fixture.detectChanges();component.close();fixture.detectChanges();expect(component.panelOpen()).toBeFalse();expect(fetchSpy.calls.all().some(call=>call.args[1]?.method==='PUT')).toBeFalse();fixture.destroy();
  }));
  it('keeps the draft and panel available when save fails',fakeAsync(()=>{
    fetchSpy.and.callFake(async(url:any,init?:RequestInit)=>init?.method==='PUT'?({ok:false,status:503} as Response):String(url).includes('/voice/voices')?({ok:true,json:()=>Promise.resolve({available:true,voices})} as Response):({ok:true,json:()=>Promise.resolve(defaultVoicePreference())} as Response));
    const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();const component=fixture.componentInstance;
    component.draft.languageLocale='de';void component.save();flushMicrotasks();fixture.detectChanges();
    expect(component.draft.languageLocale).toBe('de');expect(component.dirty()).toBeTrue();expect(component.feedback()).toBe('✕ Não foi possível salvar as preferências de voz.');expect(fixture.nativeElement.querySelector('details')).not.toBeNull();fixture.destroy();
  }));
  it('reopens with the exact persisted voice preference',fakeAsync(()=>{
    const persisted={engine:'ELEVENLABS' as const,languageLocale:'en' as const,voiceResponseMode:'OFF' as const,genderProfile:'MALE' as const,voiceId:'male',voiceName:'Male',speed:1.15};engine.preference.set(persisted);
    let fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();expect(fixture.componentInstance.draft).toEqual(persisted);fixture.destroy();
    fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();expect(fixture.componentInstance.draft).toEqual(persisted);expect(fixture.componentInstance.dirty()).toBeFalse();fixture.destroy();
  }));
  it('previews the selected ElevenLabs voice without saving it',fakeAsync(()=>{
    spyOn(HTMLMediaElement.prototype,'play').and.resolveTo();fetchSpy.calls.reset();const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();const component=fixture.componentInstance;
    component.draft={...defaultVoicePreference(),voiceId:'male',voiceName:'Male',genderProfile:'MALE'};component.preview();flushMicrotasks();fixture.detectChanges();
    expect(fetchSpy.calls.all().some(call=>call.args[1]?.method==='PUT')).toBeFalse();expect(TestBed.inject(AgentInspectorService).voiceEngine()).toEqual({requestedEngine:'ELEVENLABS',effectiveEngine:'ELEVENLABS',fallbackReason:null,voiceName:'Male'});expect(fixture.nativeElement.textContent).toContain('ElevenLabs · Male');fixture.destroy();
  }));
  it('stop aborts pending preview and ignores late audio',fakeAsync(()=>{
    flushMicrotasks();let resolve!:(response:Response)=>void;fetchSpy.and.callFake(()=>new Promise<Response>(r=>resolve=r));
    const play=spyOn(HTMLMediaElement.prototype,'play').and.resolveTo();const end=jasmine.createSpy('end');
    engine.preview({...defaultVoicePreference(),voiceId:'male'},end);const signal=fetchSpy.calls.mostRecent().args[1].signal as AbortSignal;engine.stop();expect(signal.aborted).toBeTrue();
    resolve(({ok:true,headers:new Headers({'content-type':'audio/mpeg'}),blob:()=>Promise.resolve(new Blob(['audio']))} as Response));flushMicrotasks();expect(play).not.toHaveBeenCalled();expect(end).not.toHaveBeenCalled();expect(browser.speak).not.toHaveBeenCalled();
  }));
  it('logout clears preference, replay and pending audio before another user',fakeAsync(()=>{
    flushMicrotasks();engine.available.set(false);engine.speak('Private response.','pt');flushMicrotasks();user.set(null);TestBed.flushEffects();expect(engine.replay()).toBeFalse();expect(engine.preference()).toEqual(defaultVoicePreference());user.set({userId:'B'});TestBed.flushEffects();flushMicrotasks();expect(engine.replay()).toBeFalse();
  }));
});
