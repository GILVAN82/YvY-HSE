import test from 'node:test';import assert from 'node:assert/strict';
import { detectMessageLanguage, detectRequestedResponseLanguage, resolveResponseLanguage } from '../responseLanguage';

test('voice languages resolve independently between turns',()=>{assert.equal(detectMessageLanguage('Quais ações estão atrasadas?'),'pt');assert.equal(detectMessageLanguage('Which action is most critical?'),'en');assert.equal(detectMessageLanguage('¿Qué procedimiento debo seguir?'),'es');});
test('explicit requested response language wins over detected utterance language',()=>{assert.equal(detectRequestedResponseLanguage('Explique isso em inglês.'),'en');assert.equal(resolveResponseLanguage({userMessage:'Explique isso em inglês.',uiLanguage:'pt'}),'en');});
test('detected voice language wins over UI and uncertain transcript heuristics',()=>{
 assert.equal(resolveResponseLanguage({userMessage:'CAPA 2026?',voiceLanguage:'pt',uiLanguage:'en'}),'pt');
 assert.equal(resolveResponseLanguage({userMessage:'CAPA 2026?',voiceLanguage:'fr',uiLanguage:'de'}),'fr');
});
test('typed input still resolves from message and then UI fallback',()=>{
 assert.equal(resolveResponseLanguage({userMessage:'Welche Maßnahmen sind überfällig?',uiLanguage:'en'}),'de');
 assert.equal(resolveResponseLanguage({userMessage:'CAPA 2026?',uiLanguage:'es'}),'es');
});
