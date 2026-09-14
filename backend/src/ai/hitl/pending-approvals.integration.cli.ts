/** Explicit integration gate: session-local fixtures, always rolled back; no production rows. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PostgresApprovalService } from './hitl.repository';
import type { RequestPrincipal } from '../../auth/auth.types';
const {demoDatabaseUrl}=require('../../../../database/demo/config');
async function main(){
 const connectionString=demoDatabaseUrl();assert.equal(new URL(connectionString).pathname,'/hse_app_demo');
 const db=new Client({connectionString});await db.connect();
 try{
  await db.query('BEGIN');
  await db.query(`CREATE TEMP TABLE app_user(id uuid,active boolean,role text) ON COMMIT DROP;
   CREATE TEMP TABLE projects(code text) ON COMMIT DROP;
   CREATE TEMP TABLE app_user_project(user_id uuid,project_code text) ON COMMIT DROP;
   CREATE TEMP TABLE agent_thread_state(thread_id uuid,user_id uuid) ON COMMIT DROP;
   CREATE TEMP TABLE agent_human_approval(id uuid,thread_id uuid,requested_by uuid,scope_projects text[],action_type text,summary text,reason text,risk_level text,status text,created_at timestamptz) ON COMMIT DROP;`);
  const owner=randomUUID(),other=randomUUID();
  await db.query("INSERT INTO app_user VALUES($1,true,'APPROVER'),($2,true,'APPROVER');",[owner,other]);
  await db.query("INSERT INTO projects VALUES('P1'),('P2'),('P3');");
  await db.query("INSERT INTO app_user_project VALUES($1,'P1'),($1,'P2'),($2,'P1');",[owner,other]);
  for(const [user,scope,status] of [[owner,['P1'],'PENDING'],[owner,['P2'],'PENDING'],[owner,['P1'],'APPROVED'],[owner,['P1'],'REJECTED'],[owner,['P1'],'CANCELLED'],[other,['P1'],'PENDING'],[owner,['P1','P3'],'PENDING'],[owner,[],'PENDING']] as const){
   const thread=randomUUID();await db.query('INSERT INTO agent_thread_state VALUES($1,$2)',[thread,user]);
   await db.query("INSERT INTO agent_human_approval VALUES($1,$2,$3,$4,'LOTO_SAFETY_EXECUTION','LOTO review','Human required','CRITICAL',$5,now())",[randomUUID(),thread,user,scope,status]);
  }
  const principal:RequestPrincipal={userId:owner,email:'',displayName:'Fixture',role:'APPROVER',permissions:['AI_USE','HSE_DATA_READ'],allowedProjectIds:['P1','P2']};
  const service=new PostgresApprovalService(db as any,principal);
  assert.equal((await service.listPending()).length,2);
  assert.equal((await service.listPending('P1')).length,1);
  assert.equal((await service.forPrincipal({...principal,allowedProjectIds:['P1']}).listPending()).length,1);
  assert.equal((await service.forPrincipal({...principal,allowedProjectIds:[]}).listPending()).length,0);
  await assert.rejects(service.listPending('P3'),{code:'PROJECT_SCOPE_DENIED'});
  await assert.rejects(service.forPrincipal({...principal,permissions:['AI_USE']}).listPending(),{code:'AUTHORIZATION_DENIED'});
  await db.query("DELETE FROM app_user_project WHERE user_id=$1 AND project_code='P2'",[owner]);
  assert.equal((await service.listPending()).length,1,'live revocation excludes P2 despite stale principal');
  await db.query('UPDATE app_user SET active=false WHERE id=$1',[owner]);
  assert.equal((await service.listPending()).length,0,'inactive owner cannot read approvals');
  console.log(JSON.stringify({database:'hse_app_demo',temporaryFixtures:true,checks:8,persistentWrites:0,result:'PASS'}));
 }finally{await db.query('ROLLBACK');await db.end();}
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
