import test from 'node:test';import assert from 'node:assert/strict';
import { detectMessageLanguage, detectRequestedResponseLanguage, resolveResponseLanguage } from '../responseLanguage';

test('voice languages resolve independently between turns',()=>{assert.equal(detectMessageLanguage('Quais ações estão atrasadas?'),'pt');assert.equal(detectMessageLanguage('Which action is most critical?'),'en');assert.equal(detectMessageLanguage('¿Qué procedimiento debo seguir?'),'es');});
test('explicit requested response language wins over detected utterance language',()=>{assert.equal(detectRequestedResponseLanguage('Explique isso em inglês.'),'en');assert.equal(resolveResponseLanguage({userMessage:'Explique isso em inglês.',uiLanguage:'pt'}),'en');});
