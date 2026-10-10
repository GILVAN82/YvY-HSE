import assert from 'node:assert/strict';
import test from 'node:test';
import { toolResultEvidence } from '../graph/evidence.contract';
import { verifyEvidenceContract } from '../graph/semanticVerifier';
import { verifyNode } from '../graph/nodes/verify.node';
import { composeOperationalOverview, operationalPresentationSummary } from '../graph/operationalOverview';

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

test('composes a useful localized overview only from source-specific facts',()=>{
  const items=[evidence('list_actions','SUCCESS_WITH_DATA',8),evidence('list_incidents','SUCCESS_WITH_DATA',11),evidence('get_kpi','SUCCESS_WITH_DATA',1,{trir:0.7,daysSinceLTI:42})];
  const text=composeOperationalOverview(items,'pt','Gilvan');
  assert.match(text,/Gilvan, encontrei 8 ações pendentes e 11 incidentes em aberto no escopo atual/i);
  assert.match(text,/desempenho de segurança/i);
  assert.equal(verifyEvidenceContract(text,items).status,'VERIFIED');
});

test('zero incidents and partial source failure retain verified useful content',()=>{
  const zero=[evidence('list_actions','SUCCESS_WITH_DATA',8),evidence('list_incidents','SUCCESS_NO_DATA',0),evidence('get_kpi','SUCCESS_WITH_DATA',1,{trir:0.7})];
  assert.match(composeOperationalOverview(zero,'pt'),/Nenhum incidente em aberto/i);
  assert.equal(operationalPresentationSummary('list_incidents',{status:'SUCCESS_NO_DATA',recordCount:0,data:[]},'pt'),'Nenhum incidente em aberto');
  const partial=[evidence('list_actions','SUCCESS_WITH_DATA',8),evidence('list_incidents','ERROR',0),evidence('get_kpi','SUCCESS_WITH_DATA',1,{trir:0.7})];
  const text=composeOperationalOverview(partial,'pt');
  assert.match(text,/Encontrei 8 ações pendentes/i);assert.match(text,/precisa de confirmação/i);assert.doesNotMatch(text,/incidentes encontrados/i);
});

test('KPI presentation uses values or an availability statement, never row-count language',()=>{
  const summary=operationalPresentationSummary('get_kpi',{status:'SUCCESS_WITH_DATA',recordCount:1,data:{trir:0.7,daysSinceLTI:42}},'en');
  assert.equal(summary,'TRIR: 0.7 · Days since LTI: 42');
  assert.doesNotMatch(summary,/record/i);
});

test('KPI no-data is a valid localized result',()=>{
  assert.equal(operationalPresentationSummary('get_kpi',{status:'SUCCESS_NO_DATA',recordCount:0,data:{}},'pt'),'Nenhum indicador correspondente disponível');
});
