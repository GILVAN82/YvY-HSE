import { SpeechSynthesisService } from './speech-synthesis.service';
import { SpokenResponseFormatterService } from './spoken-response-formatter.service';

describe('SpeechSynthesisService',()=>{
  it('plays all chunks in order with one voice selection and no intermediate cancellation',()=>{
    const speak=spyOn(speechSynthesis,'speak');
    const cancel=spyOn(speechSynthesis,'cancel');
    const voices=spyOn(speechSynthesis,'getVoices').and.returnValue([]);
    const end=jasmine.createSpy('end');
    const service=new SpeechSynthesisService();
    const text=('Ação ACT-0002 com prazo confirmado e prioridade alta sem interrupção. ').repeat(15).trim();
    service.speak(text,'pt',end);
    const parts:string[]=[];
    for(let index=0;index<speak.calls.count();index++) {
      const utterance=speak.calls.argsFor(index)[0];
      parts.push(utterance.text);
      expect(utterance.text.length).toBeLessThanOrEqual(220);
      utterance.onend!(new SpeechSynthesisEvent('end',{utterance}));
    }
    expect(parts.join(' ')).toBe(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(voices).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
  it('ignores late callbacks after stop and terminates on error',()=>{
    const speak=spyOn(speechSynthesis,'speak');spyOn(speechSynthesis,'cancel');
    const service=new SpeechSynthesisService();const error=jasmine.createSpy('error');
    service.speak('Long sentence without punctuation '.repeat(30),'en',undefined,error);
    const first=speak.calls.mostRecent().args[0];
    first.onerror!({} as SpeechSynthesisErrorEvent);
    first.onend!({} as SpeechSynthesisEvent);
    expect(error).toHaveBeenCalledTimes(1);expect(speak).toHaveBeenCalledTimes(1);
    service.speak('Another long sentence '.repeat(30),'en');
    const second=speak.calls.mostRecent().args[0];service.stop();second.onend!({} as SpeechSynthesisEvent);
    expect(speak).toHaveBeenCalledTimes(2);
  });
  it('replays the clean spoken text instead of the visual table',()=>{
    const speak=spyOn(speechSynthesis,'speak');spyOn(speechSynthesis,'cancel');
    const service=new SpeechSynthesisService();
    const response=new SpokenResponseFormatterService().format('**Resultado**\n| ID | Nome |\n| --- | --- |\n| 1 | Test |','pt');
    service.speak(response.spokenResponse,'pt');service.replay();
    expect(speak.calls.mostRecent().args[0].text).toBe(response.spokenResponse);
    expect(service.lastText).not.toContain('|');
  });
  it('speaks and replays in the effective language',()=>{const speak=spyOn(speechSynthesis,'speak');spyOn(speechSynthesis,'cancel');const service=new SpeechSynthesisService();expect(service.speak('Olá','pt')).toBeTrue();expect(speak).toHaveBeenCalled();expect(service.replay()).toBeTrue();});
  it('stops and mute prevents output',()=>{const cancel=spyOn(speechSynthesis,'cancel');const service=new SpeechSynthesisService();service.setMuted(true);expect(service.speak('unsafe draft','en')).toBeFalse();expect(cancel).toHaveBeenCalled();});
});
