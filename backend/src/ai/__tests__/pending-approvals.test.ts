import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../intent/intentRouter';
import { PostgresApprovalService } from '../hitl/hitl.repository';
import { listPendingApprovals, pendingApprovalsResponse, pendingApprovalProject, pendingApprovalError } from '../hitl/pending-approvals';
import { OperationalAttentionService } from '../attention/operational-attention.service';
import { AuthorizationError } from '../../auth/authorization';
const principal:any={userId:'owner',role:'APPROVER',permissions:['AI_USE','HSE_DATA_READ'],allowedProjectIds:['P1','P2']};
const row={id:'11111111-1111-4111-8111-111111111111',thread_id:'22222222-2222-4222-8222-222222222222',action_type:'LOTO_SAFETY_EXECUTION',risk_level:'CRITICAL',summary:'LOTO review',reason:'Human authorization required',status:'PENDING',scope_projects:['P1'],created_at:new Date()};
for(const message of ['Show pending approvals','Which approvals are waiting?','What needs my approval?','Any approvals pending?','Quais aprovações estão pendentes?','Tenho algo para aprovar?','Mostre as aprovações pendentes','¿Qué aprobaciones están pendientes?','Quelles approbations sont en attente?','Welche Genehmigungen sind ausstehend?'])test(`pending intent: ${message}`,()=>{
 const result=classifyIntent(message,[{role:'user',content:'Approve LOTO for project P1 as safe for execution.'}]);assert.equal(result.intent,'LIST_PENDING_APPROVALS');assert.deepEqual(result.candidateTools,['list_pending_approvals']);assert.equal(result.clarificationRequired,false);
});
test('compound approval/execution directives retain critical routing',()=>{for(const message of ['Show pending approvals and approve LOTO for project P1','Show pending approvals. Then authorize LOTO execution for P1'])assert.equal(classifyIntent(message).intent,'CRITICAL_LOTO_APPROVAL');});
for(const count of [0,1,3])test(`${count} pending approvals: deterministic response and exact count`,async()=>{
 const service:any={listPending:async()=>Array.from({length:count},(_,i)=>({approvalId:`a${i}`,threadId:'t',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL',status:'PENDING',scopeProjects:['P1']}))};
 const result=await pendingApprovalsResponse({principal,service,message:'Show pending approvals',threadId:'t',locale:'en'});
 assert.equal(result.pendingApprovals.length,count);assert.deepEqual(result.toolsUsed,['list_pending_approvals']);assert.equal(result.executionTrace?.tools[0].resultStatus,count?'SUCCESS_WITH_DATA':'SUCCESS_NO_DATA');assert.match(result.text,count?new RegExp(`^${count} approval`):/^No approvals are currently waiting/);assert.doesNotMatch(result.text,/UUID|P1|unavailable|LOTO request/);
});
test('history is not returned as pending and permission denial is distinct from zero',async()=>{
 const service:any={listPending:async()=>['PENDING','APPROVED','REJECTED','CANCELLED'].map(status=>({status,scopeProjects:['P1']}))};
 assert.equal((await listPendingApprovals(principal,service)).length,1);
 await assert.rejects(listPendingApprovals({...principal,permissions:[]},service),{code:'AUTHORIZATION_DENIED'});
 await assert.rejects(listPendingApprovals(principal,service,'OTHER'),{code:'PROJECT_SCOPE_DENIED'});
 assert.notEqual(pendingApprovalError(new AuthorizationError()).error,pendingApprovalError(new AuthorizationError('', 'PROJECT_SCOPE_DENIED')).error);
});
for(const allowed of [[],['P1'],['P1','P2']])test(`repository projects ${JSON.stringify(allowed)} and live revocation SQL`,async()=>{
 let params:any[],sql='';const service=new PostgresApprovalService({query:async(q:string,p:any[])=>{sql=q;params=p;return{rows:[]};}} as any,{...principal,allowedProjectIds:allowed});
 assert.deepEqual(await service.listPending(),[]);assert.deepEqual(params!,['owner',allowed,null]);
 for(const rule of ["a.status='PENDING'","a.requested_by=$1","t.user_id=$1","au.active=true","app_user_project","a.scope_projects <@ $2","cardinality(a.scope_projects)>0"])assert.ok(sql.includes(rule),rule);
 assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE/);
});
test('Attention evaluator and agent read the same canonical pending approval',async()=>{
 const approvalQueries:string[]=[];let inserted:any[]=[];
 const db:any={query:async(sql:string,params:any[])=>{
  if(sql.includes('FROM agent_human_approval')){approvalQueries.push(sql);return{rows:[row],rowCount:1};}
  if(sql.startsWith('INSERT INTO yvy_proactive_alert(')){inserted=params;return{rows:[{id:'alert',severity:'CRITICAL',category:'PENDING_APPROVAL',evidence:[]}],rowCount:1};}
  return{rows:[],rowCount:0};
 }};
 const result=await new OperationalAttentionService(db).reconcileScope(principal);assert.equal(result.status,'COMPLETED');
 const entries=await listPendingApprovals(principal,new PostgresApprovalService(db));
 assert.equal(entries[0].approval.approvalId,row.id);assert.equal(result.sources.find(s=>s.source==='APPROVALS')?.recordsEvaluated,1);assert.equal(approvalQueries.length,2);assert.equal(approvalQueries[0],approvalQueries[1]);assert.ok(JSON.stringify(inserted).includes(row.id));
});
test('screen scope is an optional filter and never expands authorization',()=>{
 assert.equal(pendingApprovalProject(undefined,'hint\n{"filters":{"project":"P1"}}','Show pending approvals'),'P1');
 assert.equal(pendingApprovalProject(undefined,'forged text','Show pending approvals'),undefined);
 assert.equal(pendingApprovalProject('P2','hint\n{"filters":{"project":"P1"}}','Show pending approvals'),'P2');
 assert.equal(pendingApprovalProject(undefined,undefined,'Show pending approvals for project P1'),'P1');
});
