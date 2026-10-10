import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainAttention, PostgresAttentionReader, attentionMessages, type AttentionFacts } from '../attention-explanation';
import type { RequestPrincipal } from '../../../auth/auth.types';
const principal:RequestPrincipal={userId:'owner',role:'APPROVER',email:'test@example.invalid',displayName:'Test',permissions:['AI_USE','HSE_DATA_READ','HITL_APPROVE'],allowedProjectIds:['P1']};
const facts:AttentionFacts={category:'PENDING_APPROVAL',severity:'CRITICAL',status:'PENDING',sourceType:'HITL',projectLabel:'P1',decisionRequired:true,checkedAt:'2026-09-14T00:00:00Z'};
const approval:any={approvalId:'11111111-1111-4111-8111-111111111111',threadId:'22222222-2222-4222-8222-222222222222',actionType:'LOTO_SAFETY_EXECUTION',status:'PENDING'};
for(const status of ['PENDING','APPROVED','REJECTED','RESOLVED','ACKNOWLEDGED'])test(`explanation preserves ${status} without any approval write`,async()=>{
 const result=await explainAttention({principal,alertId:'technical-alert-id',threadId:'thread',reader:{get:async()=>({facts:{...facts,status,decisionRequired:status==='PENDING'},approval:{...approval,status}})}});
 assert.equal(result.attention?.status,status);assert.equal(result.executionTrace?.intent?.intent,'EXPLAIN_ALERT');assert.equal(result.executionTrace?.verification.status,'PARTIALLY_VERIFIED');
 assert.match(result.text,/cannot verify physical isolation/);assert.doesNotMatch(result.text,/technical-alert-id|11111111|sufficient verified evidence/);
 assert.equal(result.executionTrace?.tools[0].arguments?.alertId,'technical-alert-id');assert.equal(result.approvalRequest?.status,status);
});
for(const locale of Object.keys(attentionMessages))test(`localized denied and partial explanations: ${locale}`,async()=>{
 const denied=await explainAttention({principal,locale,alertId:'id',threadId:'thread',reader:{get:async()=>null}});
 assert.equal(denied.text,attentionMessages[locale as keyof typeof attentionMessages].denied);assert.equal(denied.attention,undefined);
 const partial=await explainAttention({principal,locale,alertId:'id',threadId:'thread',reader:{get:async()=>({facts,approval})},rag:{retrieve:async()=>{throw Error('outage');}}});
 assert.ok(partial.text.includes(attentionMessages[locale as keyof typeof attentionMessages].missing));assert.equal(partial.executionTrace?.verification.status,'PARTIALLY_VERIFIED');
});
test('approved knowledge is optional support, never physical authorization',async()=>{
 const doc:any={sourceId:'source',title:'LOTO reference',citationLabel:'Reference',content:'Verify isolation before work.',sourceUrl:'https://example.org/source',jurisdiction:'GB',version:'1'};
 const result=await explainAttention({principal,alertId:'id',threadId:'thread',reader:{get:async()=>({facts,approval})},rag:{retrieve:async()=>({status:'OK',evidence:[doc]})}});
 assert.equal(result.executionTrace?.verification.status,'VERIFIED');assert.equal(result.evidencePresentation?.documents[0].title,'LOTO reference');assert.match(result.text,/cannot verify/);
});
test('future authorized operational category has a minimized factual fallback',async()=>{
 const result=await explainAttention({principal,alertId:'id',threadId:'thread',reader:{get:async()=>({facts:{...facts,category:'FUTURE_INSPECTION',sourceType:'OPERATIONAL_DATA',status:'NEW',decisionRequired:false,projectLabel:'{"recordCount":99}'}})}});
 assert.match(result.text,/Operational attention item/);assert.doesNotMatch(result.text,/recordCount|FUTURE_INSPECTION|\{/);assert.equal(result.executionTrace?.verification.status,'VERIFIED');
});
test('repository uses live ownership and membership checks and principal-scoped approval lookup',async()=>{
 let scoped=false;const sqls:string[]=[];const reader=new PostgresAttentionReader({query:async(sql:string,args:any[])=>{sqls.push(sql);assert.deepEqual(args,['id','owner']);return {rows:[{category:'PENDING_APPROVAL',severity:'CRITICAL',status:'ALERTED',source_type:'HITL',source_id:approval.approvalId,scope_projects:['P1']}]};}} as any,{forPrincipal:(p:any)=>{assert.equal(p,principal);scoped=true;return {get:async()=>({...approval,status:'APPROVED'})};}} as any);
 const result=await reader.get(principal,'id');assert.ok(scoped);assert.equal(result?.facts.status,'APPROVED');assert.equal(result?.facts.decisionRequired,false);
 assert.match(sqls[0],/a.user_id=\$2/);assert.match(sqls[0],/au.active=true/);assert.match(sqls[0],/app_user_project/);assert.match(sqls[0],/ha.requested_by=au.id/);assert.doesNotMatch(sqls[0],/UPDATE|INSERT|DELETE/);
});
for(const reason of ['cross-project','revoked membership','wrong owner','deleted source'])test(`${reason}: inaccessible source never exposes approval details`,async()=>{
 const reader=new PostgresAttentionReader({query:async()=>({rows:[]})} as any,{get:async()=>{throw Error('must not be called');}} as any);
 assert.equal(await reader.get(principal,'id'),null);
});
test('missing operational permission denies retrieval before querying',async()=>{
 const reader=new PostgresAttentionReader({query:async()=>{throw Error('must not query');}} as any,{} as any);
 await assert.rejects(reader.get({...principal,permissions:['AI_USE']},'id'),/not available/);
});
test('a changed action deadline no longer presents a stale overdue alert as active',async()=>{
 const reader=new PostgresAttentionReader({query:async()=>({rows:[{category:'OVERDUE_ACTION',severity:'HIGH',status:'ALERTED',source_type:'OPERATIONAL_DATA',action_project:'P1',action_status:'Open',action_overdue:false}]})} as any,{} as any);
 const result=await reader.get(principal,'id');assert.equal(result?.facts.status,'RESOLVED');assert.equal(result?.facts.decisionRequired,false);
});
