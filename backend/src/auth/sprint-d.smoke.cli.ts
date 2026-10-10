/** Opt-in PostgreSQL verification. All fixtures live in connection-local temporary
 * tables and the transaction is rolled back. Never part of the default test suite. */
import '../config/env.bootstrap';
import assert from 'node:assert/strict';
import { pool } from '../db/pool';
import { permissionsForRole, AuthorizationError } from './authorization';
import { PostgresAlertRepository } from '../ai/alerts/alert.repository';
import { OperationalAttentionService } from '../ai/attention/operational-attention.service';
import { PostgresApprovalService } from '../ai/hitl/hitl.repository';
import { tableScopeSql } from './table-access';
import type { RequestPrincipal } from './auth.types';

async function main(){
  const db=await pool.connect();let checks=0;
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',thread='33333333-3333-4333-8333-333333333333';
  const p:RequestPrincipal={userId:a,email:'synthetic@example.invalid',displayName:'Synthetic',role:'APPROVER',permissions:permissionsForRole('APPROVER'),allowedProjectIds:['PRJ-A']};
  try{
    await db.query('BEGIN');
    await db.query(`CREATE TEMP TABLE app_user(id uuid,role text,active boolean) ON COMMIT DROP;
      CREATE TEMP TABLE app_user_project(user_id uuid,project_code text) ON COMMIT DROP;
      CREATE TEMP TABLE projects(code text) ON COMMIT DROP;
      CREATE TEMP TABLE action_tracker_capa(action_id text,project text,action_description text,priority text,status text,target_date timestamptz) ON COMMIT DROP;
      CREATE TEMP TABLE agent_thread_state(thread_id uuid,user_id uuid) ON COMMIT DROP;
      CREATE TEMP TABLE agent_human_approval(LIKE public.agent_human_approval INCLUDING DEFAULTS) ON COMMIT DROP;
      CREATE TEMP TABLE yvy_proactive_alert(LIKE public.yvy_proactive_alert INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP;
      CREATE TEMP TABLE yvy_proactive_alert_event(LIKE public.yvy_proactive_alert_event INCLUDING DEFAULTS) ON COMMIT DROP;
      CREATE TEMP TABLE jsa_log(jsa_id text,project text) ON COMMIT DROP;
      CREATE TEMP TABLE jsa_steps_detail(jsa_id text,step_number integer) ON COMMIT DROP;`);
    await db.query("INSERT INTO app_user VALUES($1,'APPROVER',true),($2,'APPROVER',true)",[a,b]);
    await db.query("INSERT INTO projects VALUES('PRJ-A'),('PRJ-B')");
    await db.query("INSERT INTO app_user_project VALUES($1,'PRJ-A'),($2,'PRJ-B')",[a,b]);
    await db.query("INSERT INTO action_tracker_capa VALUES('ACT-A','PRJ-A','Synthetic A','High','Open',now()-interval '10 days'),('ACT-B','PRJ-B','Synthetic B','High','Open',now()-interval '10 days')");
    await db.query('INSERT INTO agent_thread_state VALUES($1,$2)',[thread,a]);
    const attention=new OperationalAttentionService(db),repo=new PostgresAlertRepository(db);
    const result=await attention.reconcileScope(p);assert.equal(result.alertsCreated,1);checks++;
    const alerts=await repo.list(a);assert.equal(alerts.length,1);assert.equal(alerts[0].sourceId,'ACT-A');checks++;
    const claimed=await repo.claimVoice(a,[alerts[0].id]);assert.equal(claimed.length,1);checks++;
    const approval=await new PostgresApprovalService(db).forPrincipal(p,'Approve LOTO safety execution for PRJ-A').create(thread,'LOTO_SAFETY_EXECUTION');
    await assert.rejects(()=>new PostgresApprovalService(db).forPrincipal({...p,userId:b,allowedProjectIds:['PRJ-A']}).resolve(approval.approvalId,thread,'APPROVE',undefined,b),e=>e instanceof AuthorizationError&&e.code==='RESOURCE_OWNERSHIP_DENIED');checks++;
    const resolved=await new PostgresApprovalService(db).forPrincipal(p).resolve(approval.approvalId,thread,'APPROVE',undefined,a);assert.equal(resolved.status,'APPROVED');checks++;
    await db.query('DELETE FROM app_user_project WHERE user_id=$1',[a]);
    assert.deepEqual(await repo.list(a,false),[]);assert.deepEqual(await repo.events(a),[]);checks++;
    await assert.rejects(()=>repo.claimVoice(a,[alerts[0].id]),e=>e instanceof AuthorizationError&&e.code==='PROJECT_SCOPE_DENIED');checks++;
    await assert.rejects(()=>repo.acknowledge(a,alerts[0].id));await assert.rejects(()=>repo.snooze(a,alerts[0].id,new Date()));await assert.rejects(()=>repo.markVoiceSpoken(a,alerts[0].id,claimed[0].voiceClaimToken!));checks++;
    assert.equal((await attention.reconcileScope(p)).sources.find(s=>s.source==='ACTIONS')?.recordsEvaluated,0);checks++;
    assert.equal((await attention.reconcileScope({...p,allowedProjectIds:[]})).alertsCreated,0);checks++;
    await db.query("INSERT INTO jsa_log VALUES('JSA-A','PRJ-A');INSERT INTO jsa_steps_detail VALUES('JSA-A',1)");
    for(const [projects,expected] of [[['PRJ-A'],1],[['PRJ-B'],0],[[],0]] as const){const params:unknown[]=[];const sql=tableScopeSql('jsa_steps_detail',projects,params);assert.equal((await db.query(`SELECT * FROM jsa_steps_detail WHERE ${sql}`,params)).rows.length,expected);checks++;}
    console.log(JSON.stringify({suite:'SPRINT_D_POSTGRES_TEMP_ONLY',checks,status:'PASS',operationalRecordsChanged:0}));
  }finally{await db.query('ROLLBACK');db.release();await pool.end();}
}
void main().catch(error=>{console.error(JSON.stringify({suite:'SPRINT_D_POSTGRES_TEMP_ONLY',status:'FAIL',code:error.code??'ASSERTION_OR_RUNTIME',message:error.message}));process.exitCode=1;});
