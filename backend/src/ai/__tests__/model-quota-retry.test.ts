import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { providerFailure } from '../observability/errors';
import { runHseAgent } from '../graph/hseAgent.runner';
import { createMockModel } from './mockModel';
import { withoutNetwork } from '../evaluation/offline-network';

test('exhausted credit is not a transient rate limit, including SDK retry wrappers', () => {
  const original = Object.assign(new Error('private provider payload'), {statusCode:429,code:'credit_balance_exhausted'});
  for(const error of [original,{lastError:original}]) {
    const failure=providerFailure(error);
    assert.equal(failure.code,'MODEL_QUOTA_EXHAUSTED');
    assert.equal(failure.recoverable,false);
    assert.doesNotMatch(failure.message,/private/);
  }
  const rate=providerFailure(Object.assign(new Error('rate limit'),{statusCode:429}));
  assert.equal(rate.code,'MODEL_RATE_LIMIT');assert.equal(rate.recoverable,true);
});

test('quota failure has zero steps and evidence, and an actionable safe message',async()=>withoutNetwork(async()=>{
  const model:any=createMockModel([{text:'unused'}]);
  model.doStream=async()=>{throw Object.assign(new Error('private'),{statusCode:429,code:'credit_balance_exhausted',isRetryable:false});};
  const emitted:any[]=[],events:any[]=[];
  const result=await runHseAgent({message:'Explain LOTO guidance',model,tools:{},emit:e=>emitted.push(e),diagnosticSink:e=>events.push(e)});
  assert.equal(result.status,'FAILED');assert.equal(result.stepCount,0);
  assert.equal(result.executionTrace?.observability?.error?.code,'MODEL_QUOTA_EXHAUSTED');
  assert.equal(result.executionTrace?.observability?.error?.recoverable,false);
  assert.ok(emitted.some(e=>e.type==='error'&&e.message.includes('restore provider credits')));
  assert.doesNotMatch(JSON.stringify(emitted),/private/);
  const diagnostic=events.find(e=>e.event==='stage_failed'&&e.stage==='provider');
  assert.equal(diagnostic.httpStatus,429);assert.equal(diagnostic.providerFailureCode,'credit_balance_exhausted');
  assert.equal(diagnostic.failureCategory,'QUOTA_OR_BILLING_ERROR');assert.doesNotMatch(JSON.stringify(events),/private/);
}));

test('manual retry starts a fresh graph run in the same thread after recoverable failure',async()=>withoutNetwork(async()=>{
  const threadId=randomUUID(), model:any=createMockModel([{text:'HSE assistance is available.'}]);
  const stream=model.doStream.bind(model);let requests=0,fail=true;
  model.doStream=async(options:any)=>{requests++;if(fail)throw Object.assign(new Error('temporary unavailable'),{statusCode:503,isRetryable:false});return stream(options);};
  const execute=()=>runHseAgent({threadId,message:'HSE help',model,tools:{},emit:()=>{},diagnosticSink:()=>{}});
  const first=await execute();assert.equal(first.status,'FAILED');assert.equal(first.executionTrace?.observability?.error?.recoverable,true);
  const repeated=await execute();assert.equal(repeated.status,'FAILED');assert.notEqual(first.runId,repeated.runId);
  const before=requests;fail=false;const recovered=await execute();
  assert.equal(recovered.status,'COMPLETED');assert.notEqual(recovered.runId,repeated.runId);assert.ok(requests>before);
  assert.equal(recovered.executionTrace?.observability?.error,undefined);
}));
