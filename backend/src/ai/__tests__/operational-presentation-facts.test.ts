import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operationalPresentationFacts, operationalPresentationFactsSchema } from '../graph/operationalPresentationFacts';

test('presentation facts carry counts only in their actual query scope',()=>{
  const output={status:'SUCCESS_WITH_DATA',recordCount:4,data:[{responsible_person:'private'}]};
  assert.equal(operationalPresentationFacts('list_actions',output,{open:true,limit:20})?.pendingCount,4);
  assert.equal(operationalPresentationFacts('list_actions',output)?.pendingCount,undefined);
  assert.equal(operationalPresentationFacts('list_actions',output,{open:true,limit:4})?.countIsLowerBound,true);
});
test('incident open count is separate from total and returned rows',()=>{
  const facts=operationalPresentationFacts('list_incidents',{status:'SUCCESS_WITH_DATA',recordCount:2,summary:{openCount:0,totalCount:12}});
  assert.equal(facts?.openCount,0);assert.equal(facts?.totalCount,12);
  assert.equal(operationalPresentationFacts('list_incidents',{status:'SUCCESS_WITH_DATA',recordCount:20},{open:true,limit:20})?.countIsLowerBound,true);
});
test('successful zero results and finite KPI values survive the typed schema',()=>{
  assert.equal(operationalPresentationFacts('list_actions',{status:'SUCCESS_NO_DATA',recordCount:0},{open:true})?.pendingCount,0);
  const facts=operationalPresentationFacts('get_kpi',{status:'SUCCESS_WITH_DATA',recordCount:1,data:{trir:.42,ltifr:0,daysSinceLTI:128,secret:'never transport'}});
  assert.deepEqual(operationalPresentationFactsSchema.parse(facts)?.metrics,{trir:.42,ltifr:0,daysSinceLTI:128});
  assert.ok(!JSON.stringify(facts).includes('secret'));
  assert.equal(operationalPresentationFacts('get_kpi',{status:'SUCCESS_WITH_DATA',data:{trir:Infinity}})?.metrics?.trir,undefined);
});
test('errors and non-operational envelopes never produce successful numeric facts',()=>{
  assert.equal(operationalPresentationFacts('list_actions',{error:true,status:'SUCCESS_WITH_DATA',recordCount:4}),undefined);
  assert.equal(operationalPresentationFacts('search_hse_knowledge',{status:'OK',evidence:[]}),undefined);
});
