import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
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
    fetchSpy=spyOn(window,'fetch').and.callFake(async(url:any)=>String(url).endsWith('/voices')?({ok:true,json:()=>Promise.resolve({available:true,voices})} as Response):String(url).endsWith('/voice-preferences')?({ok:true,json:()=>Promise.resolve(defaultVoicePreference())} as Response):({ok:true,headers:new Headers({'content-type':'audio/mpeg'}),blob:()=>Promise.resolve(new Blob(['audio']))} as Response));
    TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{user}},{provide:SpeechSynthesisService,useValue:browser}]});
    engine=TestBed.inject(VoiceEngineService);TestBed.flushEffects();flushMicrotasks();
  }));
  afterEach(()=>engine.stop());
  it('loads real catalog and save/load preferences',fakeAsync(()=>{
    flushMicrotasks();expect(engine.voices().length).toBe(3);expect(engine.available()).toBeTrue();
    let saved=false;engine.save({...defaultVoicePreference(),engine:'BROWSER'}).then(value=>saved=value);flushMicrotasks();expect(saved).toBeTrue();
    expect(fetchSpy.calls.mostRecent().args[1].credentials).toBe('include');
  }));
  it('filters female, male and unknown without inventing metadata',fakeAsync(()=>{
    flushMicrotasks();const fixture=TestBed.createComponent(VoiceSettingsComponent);fixture.detectChanges();
    fixture.componentInstance.filter.set('FEMALE');expect(fixture.componentInstance.filtered().map(v=>v.id)).toEqual(['female']);
    fixture.componentInstance.filter.set('MALE');expect(fixture.componentInstance.filtered().map(v=>v.id)).toEqual(['male']);
    fixture.componentInstance.filter.set('ALL');expect(fixture.componentInstance.filtered().map(v=>v.id)).toContain('unknown');
    fixture.destroy();
  }));
  it('distinguishes PT-PT from PT-BR metadata',fakeAsync(()=>{
    flushMicrotasks();expect(matchesLocale(engine.voices()[0],'pt-BR')).toBeTrue();expect(matchesLocale(engine.voices()[0],'pt-PT')).toBeFalse();expect(matchesLocale(engine.voices()[1],'pt-PT')).toBeTrue();expect(matchesLocale(engine.voices()[2],'pt-PT')).toBeFalse();
  }));
  it('plays ElevenLabs audio and records the effective engine only once',fakeAsync(()=>{
    flushMicrotasks();let audio:HTMLMediaElement|undefined;
    spyOn(HTMLMediaElement.prototype,'play').and.callFake(function(this:HTMLMediaElement){audio=this;return Promise.resolve();});
    const end=jasmine.createSpy('end');engine.preference.set({...defaultVoicePreference(),voiceId:'male'});engine.speak('Olá.','pt',end);flushMicrotasks();
    expect(audio).toBeDefined();expect(end).not.toHaveBeenCalled();expect(TestBed.inject(AgentInspectorService).voiceEngine()?.effectiveEngine).toBe('ELEVENLABS');
    audio!.onended!(new Event('ended'));expect(end).toHaveBeenCalledTimes(1);
  }));
  it('falls back once for technical failure and preserves locale and speed',fakeAsync(()=>{
    flushMicrotasks();fetchSpy.and.resolveTo(({ok:false,status:503,json:()=>Promise.resolve({fallbackAllowed:true,fallbackReason:'UPSTREAM_429'})} as Response));
    engine.preference.set({...defaultVoicePreference(),voiceId:'male',speed:.8});engine.speak('Olá.','pt');flushMicrotasks();
    expect(browser.speak).toHaveBeenCalledTimes(1);expect(browser.speak.calls.mostRecent().args[4]).toEqual({locale:'pt-PT',rate:.8});expect(TestBed.inject(AgentInspectorService).voiceEngine()?.fallbackReason).toBe('UPSTREAM_429');
  }));
  it('does not fallback for content rejection or send visual tables',fakeAsync(()=>{
    flushMicrotasks();engine.preference.set({...defaultVoicePreference(),voiceId:'male'});fetchSpy.and.resolveTo(({ok:false,status:422,json:()=>Promise.resolve({fallbackAllowed:false})} as Response));
    const failed=jasmine.createSpy('failed');engine.speak('Resumo.','pt',undefined,failed);flushMicrotasks();expect(browser.speak).not.toHaveBeenCalled();expect(failed).toHaveBeenCalledTimes(1);
    fetchSpy.calls.reset();engine.speak('| ID | Action |','pt',undefined,failed);flushMicrotasks();expect(fetchSpy).not.toHaveBeenCalled();
  }));
  it('mute prevents requests, previews and audio',fakeAsync(()=>{
    flushMicrotasks();fetchSpy.calls.reset();engine.setMuted(true);expect(engine.speak('Olá.','pt')).toBeFalse();expect(engine.preview(defaultVoicePreference())).toBeFalse();expect(fetchSpy).not.toHaveBeenCalled();expect(browser.setMuted).toHaveBeenCalledWith(true);
  }));
  it('preview uses draft preferences without changing normal replay',fakeAsync(()=>{
    flushMicrotasks();engine.available.set(false);engine.speak('Resposta verificada.','pt');flushMicrotasks();
    const draft={...defaultVoicePreference(),engine:'BROWSER' as const,languageLocale:'pt-BR' as const,speed:1.2};engine.preview(draft);flushMicrotasks();
    expect(browser.speak.calls.mostRecent().args[0]).toContain('para suas interações');expect(browser.speak.calls.mostRecent().args[4]).toEqual({locale:'pt-BR',rate:1.2});
    engine.preference.set({...defaultVoicePreference(),speed:.9});engine.replay();flushMicrotasks();expect(browser.speak.calls.mostRecent().args[0]).toBe('Resposta verificada.');expect(browser.speak.calls.mostRecent().args[4]?.rate).toBe(.9);
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
