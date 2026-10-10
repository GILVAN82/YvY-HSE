import { capturedContext, capturedSystem } from './mockModel';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextualGreeting, safeFirstName } from '../personalization';
import { createMockModel } from './mockModel';
import { runHseAgent } from '../graph/hseAgent.runner';
import { classifyIntent } from '../intent/intentRouter';

test('authenticated display name is reduced to a safe first name',()=>{
  assert.equal(safeFirstName('  Gilvan Amorim  '),'Gilvan');
  assert.equal(safeFirstName('<script> Gilvan'),'script');
  assert.equal(safeFirstName('1234'),undefined);
});

test('contextual greeting is localized and deterministic by time period',()=>{
  assert.equal(contextualGreeting('en','Gilvan',9),'Good morning, Gilvan.');
  assert.equal(contextualGreeting('pt','Gilvan',14),'Boa tarde, Gilvan.');
  assert.equal(contextualGreeting('de','Gilvan',20),'Guten Abend, Gilvan.');
});

test('short multilingual greetings stay inside the bounded assistant conversation',()=>{
  for(const greeting of ['Hi YvY.','Oi YvY!','Hola YvY','Bonjour YvY','Hallo YvY']){
    const decision=classifyIntent(greeting);
    assert.equal(decision.scope,'IN_SCOPE');assert.equal(decision.intent,'CONVERSATIONAL_GREETING');assert.deepEqual(decision.candidateTools,[]);
  }
});

test('first interaction receives trusted greeting context and later turns do not repeat it',async()=>{
  const first=createMockModel([{text:'General HSE assistance is available.'}]);
  await runHseAgent({message:'HSE help',authenticatedFirstName:'Gilvan',locale:'en',model:first,emit:()=>undefined});
  const firstPrompt=JSON.stringify(first.callInputs()[0]);
  assert.equal(capturedContext(first).identity.firstName,'Gilvan');assert.match(capturedSystem(first), /"firstInteraction":true/);
  const later=createMockModel([{text:'General HSE assistance is available.'}]);
  await runHseAgent({message:'HSE help',authenticatedFirstName:'Gilvan',locale:'en',history:[{role:'user',content:'HSE status'},{role:'assistant',content:'Ready.'}],model:later,emit:()=>undefined});
  const laterPrompt=JSON.stringify(later.callInputs()[0]);
  assert.match(capturedSystem(later), /"firstInteraction":false/);assert.doesNotMatch(capturedSystem(later), /Gilvan/);
});
