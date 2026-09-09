import type { Pool } from 'pg';
import { permissionsForRole, type AppRole } from '../../auth/authorization';
import type { RequestPrincipal } from '../../auth/auth.types';
import { ACTION_OVERDUE_SQL } from '../../domain/actions';
import { evaluateAlerts } from '../alerts/alert.evaluator';
import { PostgresAlertRepository } from '../alerts/alert.repository';

export type AttentionSourceName='ACTIONS'|'APPROVALS';
export interface AttentionSourceResult{source:AttentionSourceName;status:'SUCCESS'|'FAILED';recordsEvaluated:number;errorCode?:'SOURCE_UNAVAILABLE'}
export interface AttentionReconciliationResult{status:'COMPLETED'|'PARTIAL'|'FAILED';scopesEvaluated:number;sources:AttentionSourceResult[];alertsCreated:number;alertsUpdated:number;alertsResolved:number;errors:Array<{source:AttentionSourceName;code:'SOURCE_UNAVAILABLE'}>}

export interface AttentionScope{principal:RequestPrincipal}

export class OperationalAttentionService{
  private readonly repo:PostgresAlertRepository;
  constructor(private readonly db:Pick<Pool,'query'>){this.repo=new PostgresAlertRepository(db);}

  async eligibleScopes():Promise<AttentionScope[]>{const result=await this.db.query(`SELECT u.id::text,u.email,u.display_name,u.role,COALESCE(array_agg(up.project_code) FILTER(WHERE up.project_code IS NOT NULL),'{}') allowed_projects FROM app_user u LEFT JOIN app_user_project up ON up.user_id=u.id WHERE u.active=true GROUP BY u.id`);return result.rows.map(row=>{const role=row.role as AppRole;return{principal:{userId:row.id,email:row.email,displayName:row.display_name,role,permissions:permissionsForRole(role),allowedProjectIds:row.allowed_projects??[]}};}).filter(scope=>scope.principal.permissions.includes('AI_USE'));}

  async reconcileAll():Promise<AttentionReconciliationResult>{const scopes=await this.eligibleScopes();const totals:AttentionReconciliationResult={status:'COMPLETED',scopesEvaluated:0,sources:[],alertsCreated:0,alertsUpdated:0,alertsResolved:0,errors:[]};for(const scope of scopes){const result=await this.reconcileScope(scope.principal);totals.scopesEvaluated++;totals.sources.push(...result.sources);totals.alertsCreated+=result.alertsCreated;totals.alertsUpdated+=result.alertsUpdated;totals.alertsResolved+=result.alertsResolved;totals.errors.push(...result.errors);}totals.status=totals.errors.length?(totals.sources.some(s=>s.status==='SUCCESS')?'PARTIAL':'FAILED'):'COMPLETED';return totals;}

  async reconcileScope(principal:RequestPrincipal):Promise<AttentionReconciliationResult>{const result:AttentionReconciliationResult={status:'COMPLETED',scopesEvaluated:1,sources:[],alertsCreated:0,alertsUpdated:0,alertsResolved:0,errors:[]};const add=(stats:{created:number;updated:number;resolved:number})=>{result.alertsCreated+=stats.created;result.alertsUpdated+=stats.updated;result.alertsResolved+=stats.resolved;};
    try{const scoped=principal.permissions.includes('ADMIN_ACCESS')?null:principal.allowedProjectIds;const rows=await this.db.query(`SELECT action_id,action_description,priority,status,FLOOR(EXTRACT(EPOCH FROM(CURRENT_TIMESTAMP-target_date))/86400)::int days_overdue FROM action_tracker_capa WHERE ${ACTION_OVERDUE_SQL} ${scoped!==null?'AND project=ANY($1::text[])':''} AND EXISTS(SELECT 1 FROM app_user au WHERE au.id=$${scoped!==null?2:1} AND au.active=true AND (au.role='ADMIN' OR EXISTS(SELECT 1 FROM app_user_project ap WHERE ap.user_id=au.id AND ap.project_code=action_tracker_capa.project)))`,scoped!==null?[scoped,principal.userId]:[principal.userId]);const candidates=evaluateAlerts({actions:rows.rows.map(row=>({actionId:row.action_id,description:row.action_description,priority:row.priority,status:row.status,daysOverdue:Number(row.days_overdue)})),approvals:[]});add(await this.repo.sync(principal.userId,candidates,['OVERDUE_ACTION']));result.sources.push({source:'ACTIONS',status:'SUCCESS',recordsEvaluated:rows.rows.length});}catch{result.sources.push({source:'ACTIONS',status:'FAILED',recordsEvaluated:0,errorCode:'SOURCE_UNAVAILABLE'});result.errors.push({source:'ACTIONS',code:'SOURCE_UNAVAILABLE'});}
    try{const rows=await this.db.query(`SELECT a.id,a.summary,a.risk_level,a.status FROM agent_human_approval a JOIN agent_thread_state t ON t.thread_id=a.thread_id WHERE t.user_id=$1 AND a.requested_by=$1 AND a.status='PENDING' AND a.scope_projects IS NOT NULL AND cardinality(a.scope_projects)>0 AND EXISTS(SELECT 1 FROM app_user au WHERE au.id=$1 AND au.active=true AND NOT EXISTS(SELECT 1 FROM unnest(a.scope_projects) sp(project) WHERE NOT EXISTS(SELECT 1 FROM projects pr WHERE pr.code=sp.project) OR (au.role<>'ADMIN' AND NOT EXISTS(SELECT 1 FROM app_user_project ap WHERE ap.user_id=au.id AND ap.project_code=sp.project))))`,[principal.userId]);const candidates=evaluateAlerts({actions:[],approvals:rows.rows.map(row=>({approvalId:row.id,summary:row.summary,riskLevel:row.risk_level,status:row.status}))});add(await this.repo.sync(principal.userId,candidates,['PENDING_APPROVAL']));result.sources.push({source:'APPROVALS',status:'SUCCESS',recordsEvaluated:rows.rows.length});}catch{result.sources.push({source:'APPROVALS',status:'FAILED',recordsEvaluated:0,errorCode:'SOURCE_UNAVAILABLE'});result.errors.push({source:'APPROVALS',code:'SOURCE_UNAVAILABLE'});}
    result.status=result.errors.length?(result.sources.some(s=>s.status==='SUCCESS')?'PARTIAL':'FAILED'):'COMPLETED';return result;
  }
}
