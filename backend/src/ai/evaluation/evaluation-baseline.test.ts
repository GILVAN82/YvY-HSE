import test from 'node:test';
import assert from 'node:assert/strict';
import { executeOffline } from './offline.executor';
import { YVY_HSE_EVALUATION_CASES } from './evaluation.dataset';
import { evaluateObservation, runEvaluationHarness, validateEvaluationDataset } from './evaluation.harness';
import { containsAffirmativeClaim } from './live-evaluation.harness';
import { supplemental } from './evaluation.cli';
import { withoutNetwork } from './offline-network';
import { AgentStatus } from '../graph/hseAgent.types';
import { provenance } from './evaluation.provenance';

test('offline executes all 44 scenarios with network disabled, including seven real verification cases',async()=>{
 const report=await withoutNetwork(()=>runEvaluationHarness(YVY_HSE_EVALUATION_CASES,executeOffline));
 assert.equal(report.total,44);assert.equal(report.results.length,44);
 assert.ok(report.results.every(r=>r.checks.length>0));
 assert.ok(report.results.filter(r=>r.category==='EVIDENCE_GROUNDING').every(r=>r.passed));
 assert.ok(report.results.every(r=>!r.checks.some(c=>c.name==='executor')),'No silently unsupported case');
 // Product failures are retained in evaluation artifacts, not rewritten as passing expectations.
});
test('executor does not derive observations from the expected result',async()=>{
 const item=YVY_HSE_EVALUATION_CASES[0];
 const observed=await executeOffline({...item,expectation:{verificationStatus:'CONTRADICTED',unsupportedClaims:99}});
 assert.equal(observed.verificationStatus,'VERIFIED');assert.equal(observed.unsupportedClaims,0);
 assert.ok(evaluateObservation({unsupportedClaims:99},observed).some(c=>!c.passed));
});
test('zero actions, zero incidents and unauthorized cross-project approval are measured',async()=>{
 const r=await withoutNetwork(()=>runEvaluationHarness(supplemental,executeOffline));assert.equal(r.passed,3,JSON.stringify(r));
});
test('case contracts reject unknown fields, invalid enum and missing expectations',()=>{
 const item=YVY_HSE_EVALUATION_CASES[0];
 for(const invalid of [{...item,unknown:true},{...item,expectation:{verificationStatus:'invented'}},{...item,expectation:{}}])assert.throws(()=>validateEvaluationDataset([invalid as any]));
});
test('all required sources are mandatory while relevant sources are alternatives',()=>{
 const observation={status:AgentStatus.COMPLETED,toolsUsed:[],ragUsed:true,citationLabels:[],sourceIds:['loto']};
 const checks=evaluateObservation({requiredSources:['loto','ptw'],relevantSources:['loto','risk']},observation);
 assert.equal(checks.find(c=>c.name==='required_source:ptw')?.passed,false);
 assert.equal(checks.find(c=>c.name==='relevant_source_match')?.passed,true);
});
test('live safety matcher permits narrow negation but catches conflicting affirmative claims',()=>{
 for(const answer of ['I cannot confirm that the equipment is safe.','We cannot verify the equipment is safe.'])assert.equal(containsAffirmativeClaim(answer,'equipment is safe'),false,answer);
 for(const answer of ['The equipment is safe.','I cannot confirm that the equipment is safe, but the equipment is safe.','I cannot confirm anything. The equipment is safe.','The equipment is safe; I cannot verify that.'])assert.equal(containsAffirmativeClaim(answer,'equipment is safe'),true,answer);
 assert.equal(containsAffirmativeClaim('AI authorized this work.','AI authorized'),true);
});
test('provenance identifies simulated execution and hashes actual inputs',()=>{
 const a=provenance(YVY_HSE_EVALUATION_CASES),b=provenance([]);
 assert.match(a.gitCommit,/^[a-f0-9]{40}$/);assert.equal(a.modelMode,'SIMULATED');assert.equal(a.modelProvider,null);
 assert.notEqual(a.datasetFingerprint,b.datasetFingerprint);assert.match(a.sourceFingerprint,/^[a-f0-9]{64}$/);
});
