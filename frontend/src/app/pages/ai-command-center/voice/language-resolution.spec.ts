import { detectConversationLanguage, requestedResponseLanguage } from './language-resolution';

describe('voice language resolution',()=>{
  it('detects Portuguese, English and Spanish independently per turn',()=>{expect(detectConversationLanguage('Quais ações estão atrasadas?')).toBe('pt');expect(detectConversationLanguage('Which action is most critical?')).toBe('en');expect(detectConversationLanguage('¿Qué procedimiento debo seguir?')).toBe('es');});
  it('allows an explicit requested response language to override the utterance language',()=>{expect(detectConversationLanguage('Explique isso em inglês.')).toBe('pt');expect(requestedResponseLanguage('Explique isso em inglês.')).toBe('en');});
  it('detects short Portuguese operational questions',()=>{expect(detectConversationLanguage('Tem alguma pendência?')).toBe('pt');expect(detectConversationLanguage('O que precisa de atenção?')).toBe('pt');expect(detectConversationLanguage('Tem incidente aberto?')).toBe('pt');});
  it('uses the supported browser language only when speech has no linguistic signal',()=>{expect(detectConversationLanguage('12345','pt-PT')).toBe('pt');expect(detectConversationLanguage('12345','it-IT')).toBe('en');});
});
