import { detectConversationLanguage, requestedResponseLanguage } from './language-resolution';

describe('voice language resolution',()=>{
  it('detects Portuguese, English and Spanish independently per turn',()=>{expect(detectConversationLanguage('Quais ações estão atrasadas?')).toBe('pt');expect(detectConversationLanguage('Which action is most critical?')).toBe('en');expect(detectConversationLanguage('¿Qué procedimiento debo seguir?')).toBe('es');});
  it('allows an explicit requested response language to override the utterance language',()=>{expect(detectConversationLanguage('Explique isso em inglês.')).toBe('pt');expect(requestedResponseLanguage('Explique isso em inglês.')).toBe('en');});
});
