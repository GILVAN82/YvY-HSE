import assert from 'node:assert/strict';
import test from 'node:test';
import { INTENT_EVALUATION_DATASET } from './intentEvaluation.dataset';
import { classifyIntent } from './intentRouter';

test('intent evaluation dataset contains all required categories and at least 100 cases',()=>{
 assert.equal(INTENT_EVALUATION_DATASET.length,120);
 for(const item of INTENT_EVALUATION_DATASET)assert.ok(item.input&&item.language&&item.expectedScope&&item.expectedIntent);
});
test('intent evaluation dataset routes conversational inputs',()=>{
 for(const item of INTENT_EVALUATION_DATASET){
  const actual=classifyIntent(item.input);
  if(item.expectedScope==='LIKELY_IN_SCOPE') assert.notEqual(actual.scope,'OUT_OF_SCOPE',item.input);
  else assert.equal(actual.scope,item.expectedScope,item.input);
  if(item.expectedTool)assert.ok(actual.candidateTools.includes(item.expectedTool),item.input);
  if(item.expectedClarification)assert.equal(actual.clarificationRequired,true,item.input);
 }
});
test('same-thread short follow-up retains the action route',()=>{
 const actual=classifyIntent('How many are critical?',[{role:'user',content:'Which actions are overdue?'},{role:'assistant',content:'Two actions are overdue.'}]);
 assert.equal(actual.scope,'LIKELY_IN_SCOPE');assert.equal(actual.intent,'LIST_OVERDUE_ACTIONS');assert.deepEqual(actual.toolArguments,{overdue:true});assert.deepEqual(actual.candidateTools,['list_actions']);
});
test('normalization preserves operational identifiers, dates and numbers',()=>{
 const actual=classifyIntent('PRJ-007: Which 2026 actions are OVER DO?');
 assert.match(actual.normalizedQuery,/prj-007/);assert.match(actual.normalizedQuery,/2026/);assert.equal(actual.intent,'LIST_OVERDUE_ACTIONS');
});
