import { SpeechSynthesisService } from './speech-synthesis.service';

describe('SpeechSynthesisService',()=>{
  it('speaks and replays in the effective language',()=>{const speak=spyOn(speechSynthesis,'speak');spyOn(speechSynthesis,'cancel');const service=new SpeechSynthesisService();expect(service.speak('Olá','pt')).toBeTrue();expect(speak).toHaveBeenCalled();expect(service.replay()).toBeTrue();});
  it('stops and mute prevents output',()=>{const cancel=spyOn(speechSynthesis,'cancel');const service=new SpeechSynthesisService();service.setMuted(true);expect(service.speak('unsafe draft','en')).toBeFalse();expect(cancel).toHaveBeenCalled();});
});
