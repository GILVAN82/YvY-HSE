import assert from 'node:assert/strict';
import test from 'node:test';
import { toolResultEvidence } from '../graph/evidence.contract';
import { verifyEvidenceContract } from '../graph/semanticVerifier';
import { verifyNode } from '../graph/nodes/verify.node';

const evidence=(tool:string,status:'SUCCESS_WITH_DATA'|'SUCCESS_NO_DATA'|'ERROR',recordCount:number,data:unknown=[])=>
  toolResultEvidence(tool,status==='ERROR'?{error:true}:{status,recordCount,data},0);

test('multi-source overview maps each count to its own operational source',()=>{
  const items=[evidence('list_actions','SUCCESS_WITH_DATA',8),evidence('list_incidents','SUCCESS_WITH_DATA',11),evidence('get_kpi','SUCCESS_WITH_DATA',1,{available:true})];
  const verified=verifyEvidenceContract('There are 8 matching actions. There are 11 matching incidents. Safety performance data is available.',items);
  assert.equal(verified.status,'VERIFIED');assert.equal(verified.verifiedClaims,3);
  const swapped=verifyEvidenceContract('There are 11 matching actions. There are 8 matching incidents.',items);
  assert.equal(swapped.status,'CONTRADICTED');
});

test('one zero-result source remains valid inside a successful overview',()=>{
  const result=verifyEvidenceContract('There are 8 matching actions. No incidents were found. Safety performance data is available.',[
    evidence('list_actions','SUCCESS_WITH_DATA',8),evidence('list_incidents','SUCCESS_NO_DATA',0),evidence('get_kpi','SUCCESS_WITH_DATA',1,{available:true}),
  ]);
  assert.equal(result.status,'VERIFIED');assert.equal(result.unsupportedClaims,0);
});

test('a verified source plus an unsupported operational capability is partial',()=>{
  const result=verifyEvidenceContract('There are 8 matching actions. There are 2 active permits.',[evidence('list_actions','SUCCESS_WITH_DATA',8)]);
  assert.equal(result.status,'PARTIALLY_VERIFIED');assert.equal(result.verifiedClaims,1);assert.equal(result.unsupportedClaims,1);
});

test('verification node preserves usable partial evidence without turning the run into an execution error',async()=>{
  const partial=await verifyNode({
    status:'PROCESSING',finalText:'There are 8 matching actions. There are 2 active permits.',
    evidence:[evidence('list_actions','SUCCESS_WITH_DATA',8)],executedRoute:['guard','agent'],stepCount:2,
  } as any,{configurable:{runtime:{responseLanguage:'en'}}} as any);
  assert.equal(partial.status,'VERIFIED');
  assert.equal(partial.verificationResult?.status,'PARTIALLY_VERIFIED');
  assert.equal(partial.errorCode,undefined);
  assert.match(partial.finalText??'',/couldn't verify the full summary/i);
});
