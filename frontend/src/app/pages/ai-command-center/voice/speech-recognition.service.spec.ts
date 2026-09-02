import { SpeechRecognitionService } from './speech-recognition.service';

describe('SpeechRecognitionService',()=>{
  it('preserves the original transcript and resolves an explicit response language',()=>{const service=new SpeechRecognitionService();const metadata=service.resolveMetadata({transcript:'Explique isso em inglês.',detectedLanguage:'pt',languageConfidence:.9});expect(metadata.transcript).toBe('Explique isso em inglês.');expect(metadata.inputMode).toBe('voice');expect(metadata.effectiveResponseLanguage).toBe('en');});
  it('reports unsupported STT without microphone hardware',async()=>{const speech=(globalThis as any).SpeechRecognition,webkit=(globalThis as any).webkitSpeechRecognition;delete (globalThis as any).SpeechRecognition;delete (globalThis as any).webkitSpeechRecognition;const service=new SpeechRecognitionService();await expectAsync(service.listen()).toBeRejectedWithError('STT_UNAVAILABLE');(globalThis as any).SpeechRecognition=speech;(globalThis as any).webkitSpeechRecognition=webkit;});
});
