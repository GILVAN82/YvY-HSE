import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionsForRole, AuthorizationError, type AppRole } from '../authorization';
import { authorizeRecordWrite, authorizeTable, tablePolicy, tableScopeSql } from '../table-access';
import metadata from '../../config/tableMeta.json';
import { createAppDataTools } from '../../ai/appDataTools';
import { OperationalAttentionService } from '../../ai/attention/operational-attention.service';
import { PostgresAlertRepository } from '../../ai/alerts/alert.repository';
import { PostgresApprovalService } from '../../ai/hitl/hitl.repository';
import { withAttentionLock } from '../../ai/attention/attention-lock';
import { OperationalAttentionScheduler } from '../../ai/attention/operational-attention.scheduler';
import type { RequestPrincipal } from '../auth.types';
import { requireAuthentication } from '../auth.middleware';
import { PostgresThreadStateStore } from '../../ai/graph/threadState.repository';
import { createGenericRouter } from '../../routes/generic';
import express from 'express';
import http from 'node:http';

const principal=(role:AppRole='HSE_USER',projects=['PRJ-A'],userId='user-a'):RequestPrincipal=>({userId,role,email:'test@example.invalid',displayName:'Test',permissions:permissionsForRole(role),allowedProjectIds:projects});
const forbidden=(code:string)=>(error:unknown)=>error instanceof AuthorizationError&&error.code===code;

test('A/B/C: explicit admin global, scoped user and empty allowlist are distinct',()=>{
  const p:unknown[]=[];assert.equal(tableScopeSql('incident_register',null,p),'TRUE');
  assert.match(tableScopeSql('incident_register',['PRJ-A'],p),/ANY/);assert.deepEqual(p,[['PRJ-A']]);
  const empty:unknown[]=[];assert.match(tableScopeSql('incident_register',[],empty),/ANY/);assert.deepEqual(empty,[[]]);
  assert.throws(()=>tableScopeSql('incident_register',['PRJ-A'],[],'PRJ-B'),forbidden('PROJECT_SCOPE_DENIED'));
});
test('C: attention does not remove the SQL predicate for an empty allowlist',async()=>{
  const calls:{sql:string;params:unknown[]}[]=[];
  const db={query:async(sql:string,params:unknown[])=>{calls.push({sql,params});return {rows:[],rowCount:0};}};
  const result=await new OperationalAttentionService(db as any).reconcileScope(principal('HSE_USER',[]));
  const actions=calls.find(c=>c.sql.includes('FROM action_tracker_capa'))!;
  assert.match(actions.sql,/project=ANY/);assert.deepEqual(actions.params,[[],'user-a']);assert.match(actions.sql,/app_user_project/);assert.equal(result.alertsCreated,0);
});
test('K/L/M: child joins, explicit global references and unknown scopes fail closed',()=>{
  for(const table of ['jsa_steps_detail','audit_tracker__audit_findings_detail_register']){
    const params:unknown[]=[];const sql=tableScopeSql(table,['PRJ-B'],params);
    assert.match(sql,/NOT EXISTS/);assert.match(sql,/p\."project"/);assert.deepEqual(params,[['PRJ-B']]);
  }
  assert.equal(tablePolicy('legal_compliance_register').scope.kind,'GLOBAL');
  assert.equal(tableScopeSql('legal_compliance_register',[],[]),'TRUE');
  assert.throws(()=>tableScopeSql('new_unreviewed_table',null,[]),forbidden('PROJECT_SCOPE_DENIED'));
  assert.throws(()=>authorizeTable(principal(),'contractor_management','read',true));
});
test('every registered table has explicit field and scope policies; unknown fields never enter model output',async()=>{
  for(const module of Object.values(metadata))for(const table of module.tables){
    const p=tablePolicy(table.db_table);
    assert.deepEqual([...p.allowedForModel,...p.blocked].sort(),table.columns.map(c=>c.name).sort());
    for(const name of ['prepared_by','reviewed_by','changed_by','injured_person_name'])assert.ok(!p.allowedForModel.includes(name));
  }
  const db={query:async(sql:string)=>({rows:sql.includes('COUNT')?[{total:1}]:[{jsa_id:'JSA-A',project:'PRJ-A',prepared_by:'PRIVATE',unexpected_secret:'PRIVATE'}]})};
  const tool=createAppDataTools(db as any,principal()).query_app_records as any;
  const out=await tool.execute({sheet:'JSA Log',tableIndex:0,limit:20,page:1});
  assert.equal(out.data[0].prepared_by,undefined);assert.equal(out.data[0].unexpected_secret,undefined);assert.equal(out.data[0].jsa_id,'JSA-A');
});
test('N/O: read permission never authorizes writes; write permission never overrides project scope',async()=>{
  const db={query:async()=>({rows:[{project:'PRJ-A'}]})};
  await assert.rejects(()=>authorizeRecordWrite(db,principal(),'incident_register',{project_code:'PRJ-A'}),forbidden('AUTHORIZATION_DENIED'));
  const writer={...principal(),permissions:[...principal().permissions,'HSE_DATA_WRITE' as const]};
  await authorizeRecordWrite(db,writer,'incident_register',{project_code:'PRJ-A'});
  await assert.rejects(()=>authorizeRecordWrite(db,writer,'incident_register',{project_code:'PRJ-B'}),forbidden('PROJECT_SCOPE_DENIED'));
  await assert.rejects(()=>authorizeRecordWrite(db,{...writer,allowedProjectIds:['PRJ-B']},'jsa_steps_detail',{jsa_id:'JSA-A'}),forbidden('PROJECT_SCOPE_DENIED'));
});

test('D/E/F: revocation hides active/history and denies claim, acknowledge, snooze and spoken updates',async()=>{
  let revoked=false;const mutations:string[]=[];
  const db={query:async(sql:string)=>{
    if(sql.startsWith('SELECT user_id'))return {rows:[{user_id:'user-a'}],rowCount:1};
    // The fake honors live membership only when the production query explicitly asks for it.
    if(sql.includes('app_user_project')){
      assert.match(sql,/app_user au/);assert.match(sql,/src\.project/);
      if(revoked)return {rows:[],rowCount:0};
      if(sql.startsWith('SELECT id'))return {rows:[{id:'alert-a'}],rowCount:1};
      if(sql.startsWith('SELECT'))return {rows:[{id:'alert-a',summary:'PROJECT A PRIVATE',evidence:[]}],rowCount:1};
    }
    mutations.push(sql);return {rows:[],rowCount:0};
  }};
  const repo=new PostgresAlertRepository(db as any);
  assert.equal((await repo.list('user-a',false)).length,1);
  revoked=true;
  assert.deepEqual(await repo.list('user-a',false),[]);assert.deepEqual(await repo.events('user-a'),[]);
  for(const operation of [()=>repo.claimVoice('user-a',['alert-a']),()=>repo.acknowledge('user-a','alert-a'),()=>repo.snooze('user-a','alert-a',new Date()),()=>repo.markVoiceSpoken('user-a','alert-a','token')])await assert.rejects(operation,forbidden('PROJECT_SCOPE_DENIED'));
  assert.equal(mutations.length,0);
});
test('I/J: known LOTO approval ID does not bypass project or resource ownership',async()=>{
  let updates=0;
  const db={query:async(sql:string)=>{if(sql.startsWith('UPDATE'))updates++;return {rows:[{requested_by:'user-a',scope_projects:['PRJ-A']}],rowCount:1};}};
  const service=new PostgresApprovalService(db as any);
  await assert.rejects(()=>service.forPrincipal(principal('APPROVER',['PRJ-B'])).resolve('approval','thread','APPROVE',undefined,'user-a'),forbidden('PROJECT_SCOPE_DENIED'));
  await assert.rejects(()=>service.forPrincipal(principal('APPROVER',['PRJ-A'],'user-b')).resolve('approval','thread','REJECT',undefined,'user-b'),forbidden('RESOURCE_OWNERSHIP_DENIED'));
  assert.equal(updates,0);
});
test('legacy or unknown LOTO resource scope cannot be approved',async()=>{
  const service=new PostgresApprovalService({query:async()=>({rows:[{requested_by:'user-a',scope_projects:null}]})} as any).forPrincipal(principal('APPROVER'));
  await assert.rejects(()=>service.resolve('approval','thread','APPROVE',undefined,'user-a'),forbidden('PROJECT_SCOPE_DENIED'));
});
test('P: scheduler and manual evaluation share one lock; busy work never takes a stale snapshot',async()=>{
  let locked=false,executions=0,releaseWork!:()=>void;
  const work=new Promise<void>(resolve=>releaseWork=resolve);
  const pool={query:async()=>({rows:[],rowCount:1}),connect:async()=>({query:async(sql:string)=>{
    if(sql.includes('try_advisory')){if(locked)return{rows:[{acquired:false}]};locked=true;return{rows:[{acquired:true}]};}
    locked=false;return{rows:[]};},release:()=>{}})};
  const attention={reconcileAll:async()=>{executions++;await work;return{status:'COMPLETED',scopesEvaluated:0,sources:[],alertsCreated:0,alertsUpdated:0,alertsResolved:0,errors:[]};}};
  const scheduler=new OperationalAttentionScheduler(pool as any,attention as any);
  const running=scheduler.runNow();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await withAttentionLock(pool as any,async()=>{executions++;}),{status:'BUSY'});
  releaseWork();await running;assert.equal(executions,1);
  const next=await withAttentionLock(pool as any,async()=>{executions++;return 'fresh';});assert.equal(next.status,'COMPLETED');assert.equal(executions,2);
});

test('authentication outage is 503; a missing session is 401, never an empty result',async()=>{
  for(const [authenticate,status,code] of [[async()=>{throw Error('database password SECRET');},503,'AUTH_UNAVAILABLE'],[async()=>null,401,'AUTHENTICATION_REQUIRED']] as const){
    let actualStatus=0,body:any;const res={status(n:number){actualStatus=n;return this;},json(value:unknown){body=value;}};
    await requireAuthentication({authenticate} as any)({headers:{}} as any,res as any,()=>assert.fail('unauthenticated request continued'));
    assert.equal(actualStatus,status);assert.equal(body.code,code);assert.doesNotMatch(JSON.stringify(body),/SECRET/);
  }
});

test('owned conversation evidence from a revoked scope is not restored',async()=>{
  const db={query:async()=>({rowCount:1,rows:[{thread_id:'thread',user_id:'user-a',messages:[{role:'assistant',content:'PRIVATE'}],context:{authorizationScope:{global:false,projects:['PRJ-A']}},version:1}]})};
  const store=new PostgresThreadStateStore(db as any);
  assert.ok(await store.forPrincipal(principal()).load('thread','user-a'));
  await assert.rejects(()=>store.forPrincipal(principal('HSE_USER',[])).load('thread','user-a'),forbidden('PROJECT_SCOPE_DENIED'));
});

test('HTTP generic write gate rejects a reader before SQL and a scoped writer before INSERT',async()=>{
  let current=principal(),inserts=0;
  const app=express();app.use(express.json());app.use((req,_res,next)=>{(req as any).principal=current;next();});
  app.use(createGenericRouter({query:async()=>{inserts++;return{rows:[]};}} as any));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const request=(body:unknown)=>new Promise<{status:number;body:any}>((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:(server.address() as any).port,path:'/data/Incident%20Register/0',method:'POST',headers:{'Content-Type':'application/json'}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(data)}));});req.on('error',reject);req.end(JSON.stringify(body));
  });
  try{
    assert.equal((await request({project_code:'PRJ-A'})).body.code,'AUTHORIZATION_DENIED');
    current=principal('HSE_MANAGER',['PRJ-A']);
    const denied=await request({project_code:'PRJ-B'});assert.equal(denied.status,403);assert.equal(denied.body.code,'PROJECT_SCOPE_DENIED');assert.equal(inserts,0);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
