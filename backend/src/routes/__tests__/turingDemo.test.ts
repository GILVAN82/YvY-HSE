import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createTuringDemoRouter, readDemoConfiguration, productionDemoProbe } from '../turingDemo';

const principal={userId:'11111111-1111-4111-8111-111111111111',email:'demo@example.invalid',displayName:'Demo',role:'HSE_USER' as const,permissions:['AI_USE','HSE_DATA_READ'] as any,allowedProjectIds:['PRJ-001']};
const configured={enabled:true,safeDataDeclared:true,project:'PRJ-001'};
async function request(path:string, options:{enabled?:boolean;user?:typeof principal|null;probe?:any}={}){
  let calls=0;const app=express();app.use((req,_res,next)=>{(req as any).principal=options.user===undefined?principal:options.user;next();});
  app.use(createTuringDemoRouter(async(...args)=>{calls++;return options.probe?options.probe(...args):{agent:true,rag:true,operational:true,voice:'CONFIGURED',approval:null};},()=>({...configured,enabled:options.enabled??true})));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  try{const response=await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`);return{status:response.status,body:await response.json() as Record<string,unknown>,calls};}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
test('demo disabled by default and invalid project configuration fails closed',()=>{assert.deepEqual(readDemoConfiguration({}),{enabled:false,safeDataDeclared:false,project:null});assert.equal(readDemoConfiguration({TURING_DEMO_MODE:'TRUE',TURING_DEMO_PROJECT:'../secret'}).enabled,false);});
test('disabled config creates no probe; disabled preflight has no database access',async()=>{assert.deepEqual((await request('/ai/turing-demo/config',{enabled:false})).body,{enabled:false});const result=await request('/ai/turing-demo/preflight',{enabled:false});assert.equal(result.status,404);assert.equal(result.calls,0);});
test('demo routes require actual authentication and AI permission',async()=>{assert.equal((await request('/ai/turing-demo/config',{user:null})).status,401);assert.equal((await request('/ai/turing-demo/preflight',{user:{...principal,permissions:[]}})).status,403);});
test('preflight returns readiness without granting approver permission',async()=>{const r=await request('/ai/turing-demo/preflight');assert.equal(r.body.status,'READY');assert.equal(r.body.canApprove,false);});
test('missing data or voice produces warning rather than fabricated evidence',async()=>{const r=await request('/ai/turing-demo/preflight',{probe:async()=>({agent:true,rag:false,operational:false,voice:'DEGRADED',approval:null})});assert.equal(r.body.status,'READY_WITH_WARNINGS');assert.equal(r.body.project,null);});
test('agent unavailability blocks and exceptions are not exposed',async()=>{assert.equal((await request('/ai/turing-demo/preflight',{probe:async()=>({agent:false})})).body.status,'BLOCKED');const r=await request('/ai/turing-demo/preflight',{probe:async()=>{throw new Error('secret SQL');}});assert.equal(r.status,503);assert.equal(JSON.stringify(r.body).includes('secret'),false);});
test('preflight validates thread and rejects unexpected request fields',async()=>{const r=await request('/ai/turing-demo/preflight?threadId=bad');assert.equal(r.status,400);assert.equal(r.calls,0);assert.equal((await request('/ai/turing-demo/preflight?approve=true')).status,400);});
test('production preflight never samples customer data or trusts the flag alone',async()=>{
  const queries:string[]=[];const db:any={query:async(sql:string)=>{queries.push(sql);return{rows:sql.includes('current_database')?[{name:'customer_database'}]:[{available:true}]};}};
  const result=await productionDemoProbe(db)(principal,configured);assert.equal(result.operational,false);assert.equal(result.approval,null);assert.equal(queries.length,2);assert.ok(queries.every(q=>q.startsWith('SELECT')));
});
test('safe database still requires explicit operator attestation and project scope',async()=>{
  const db:any={query:async(sql:string)=>({rows:sql.includes('current_database')?[{name:'hse_app_demo'}]:[{available:true}]})};
  assert.equal((await productionDemoProbe(db)(principal,{...configured,safeDataDeclared:false})).operational,false);
  assert.equal((await productionDemoProbe(db)({...principal,allowedProjectIds:[]},configured)).operational,false);
});

test('stale dispatch marker can discover pending approval in another owned project thread, then authorizes the resource',async()=>{
  const stale='22222222-2222-4222-8222-222222222222',pendingThread='33333333-3333-4333-8333-333333333333';
  const queries:Array<{sql:string;args:any[]}>=[];
  const db:any={query:async(sql:string,args:any[]=[])=>{queries.push({sql,args});
    if(sql.includes('current_database'))return{rows:[{name:'hse_app_demo'}]};
    if(sql.startsWith('SELECT code FROM projects'))return{rows:[{code:'PRJ-001'}]};
    if(sql.includes('rag_documents'))return{rows:[{available:true}]};
    if(sql.startsWith('SELECT id FROM agent_human_approval'))return{rows:[{id:'approval-pending'}]};
    return{rowCount:1,rows:[{id:'approval-pending',thread_id:pendingThread,status:'PENDING',scope_projects:['PRJ-001'],created_at:new Date()}]};
  }};
  const result=await productionDemoProbe(db)(principal,configured,stale);
  assert.equal((result.approval as any).threadId,pendingThread);assert.equal((result.approval as any).status,'PENDING');
  const select=queries.find(q=>q.sql.startsWith('SELECT id FROM agent_human_approval'))!;
  assert.deepEqual(select.args,[principal.userId,stale,'PRJ-001']);
  assert.match(select.sql,/status='PENDING' OR thread_id=\$2/);assert.match(select.sql,/ORDER BY \(thread_id=\$2::uuid\) DESC NULLS LAST/);
  assert.ok(queries.some(q=>q.sql.includes('SELECT a.*')&&q.args[1]===principal.userId));assert.ok(queries.every(q=>q.sql.startsWith('SELECT')));
});

test('preflight never exposes a fallback approval rejected by canonical ownership authorization',async()=>{
  const db:any={query:async(sql:string)=>sql.includes('current_database')?{rows:[{name:'hse_app_demo'}]}:sql.startsWith('SELECT a.*')?{rowCount:0,rows:[]}:sql.startsWith('SELECT id FROM agent_human_approval')?{rows:[{id:'inaccessible'}]}:{rows:[{code:'PRJ-001',available:true}]}};
  assert.equal((await productionDemoProbe(db)(principal,configured,'22222222-2222-4222-8222-222222222222')).approval,null);
});
