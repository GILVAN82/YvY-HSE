import { assertPermission, assertProjectAccess, AuthorizationError, denyAccess } from '../../auth/authorization';
import type { RequestPrincipal } from '../../auth/auth.types';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { ApprovalActionType, ApprovalRequest, HumanDecision } from './hitl.types';
import { hasLotoContext, isLotoExecutionFollowUp } from './hitl.policy';
import { PostgresThreadStateStore } from '../graph/threadState.repository';

export class ApprovalResolutionError extends Error {}

function map(row: any): ApprovalRequest {
  return { approvalId: row.id, threadId: row.thread_id, actionType: row.action_type, summary: row.summary, reason: row.reason, riskLevel: row.risk_level, status: row.status, requestedAt: row.created_at.toISOString(), ...(row.resolved_at ? { resolvedAt: row.resolved_at.toISOString() } : {}), ...(row.resolution_note ? { resolutionNote: row.resolution_note } : {}) };
}

export class PostgresApprovalService {
  constructor(private readonly db: Pick<Pool,'query'>,private readonly principal?:RequestPrincipal,private readonly requestText='') {}
  forPrincipal(principal:RequestPrincipal,message=''){return new PostgresApprovalService(this.db,principal,message);}
  private owner(){if(!this.principal)throw new AuthorizationError(undefined,'RESOURCE_OWNERSHIP_DENIED');return this.principal;}
  /** Shared source for Attention and the agent. No creation, decisions or side effects. */
  async listPending(project?:string):Promise<ApprovalRequest[]> {
    const p=this.owner();assertPermission(p,'AI_USE','approval','read');assertPermission(p,'HSE_DATA_READ','approval','read');
    if(project)assertProjectAccess(p,project);
    const allowed=p.permissions.includes('ADMIN_ACCESS')?null:p.allowedProjectIds;
    const result=await this.db.query(`SELECT a.id,a.thread_id,a.action_type,a.summary,a.reason,a.risk_level,a.status,a.created_at,a.scope_projects
      FROM agent_human_approval a JOIN agent_thread_state t ON t.thread_id=a.thread_id
      WHERE t.user_id=$1 AND a.requested_by=$1 AND a.status='PENDING' AND cardinality(a.scope_projects)>0
      AND ($2::text[] IS NULL OR a.scope_projects <@ $2::text[])
      AND ($3::text IS NULL OR $3=ANY(a.scope_projects))
      AND EXISTS(SELECT 1 FROM app_user au WHERE au.id=$1 AND au.active=true
        AND NOT EXISTS(SELECT 1 FROM unnest(a.scope_projects) sp(project)
          WHERE NOT EXISTS(SELECT 1 FROM projects pr WHERE pr.code=sp.project)
          OR (au.role<>'ADMIN' AND NOT EXISTS(SELECT 1 FROM app_user_project ap WHERE ap.user_id=au.id AND ap.project_code=sp.project))))
      ORDER BY a.created_at DESC,a.id`,[p.userId,allowed,project??null]);
    return result.rows.map(row=>({...map(row),scopeProjects:[...row.scope_projects]}));
  }
  async create(threadId: string, actionType: ApprovalActionType): Promise<ApprovalRequest> {
    const p=this.owner();assertPermission(p,'AI_USE','loto','prepare');
    const existingThread=await this.db.query('SELECT user_id FROM agent_thread_state WHERE thread_id=$1',[threadId]);
    if(existingThread.rows.length&&existingThread.rows[0].user_id!==p.userId)denyAccess(p,'RESOURCE_OWNERSHIP_DENIED','loto','prepare');
    const projects=await this.db.query('SELECT code FROM projects');
    let scope=projects.rows.map(row=>String(row.code)).filter(code=>this.requestText.split(/[^\w-]+/).includes(code));
    if(!scope.length && isLotoExecutionFollowUp(this.requestText)){
      // Never trust client-supplied history or reuse an arbitrary old project.
      const thread=await new PostgresThreadStateStore(this.db,p).load(threadId,p.userId);
      const prior=thread?.messages.slice().reverse().find(turn=>turn.role==='user');
      if(prior && hasLotoContext(prior.content))scope=projects.rows.map(row=>String(row.code)).filter(code=>prior.content.split(/[^\w-]+/).includes(code));
      // Multiple antecedent projects require an explicit choice in the request.
      if(scope.length!==1)denyAccess(p,'PROJECT_SCOPE_DENIED','loto','prepare');
    }
    if(!scope.length)denyAccess(p,'PROJECT_SCOPE_DENIED','loto','prepare');
    scope.forEach(code=>assertProjectAccess(p,code));
    const summary = 'LOTO safety execution approval requested';
    const reason = 'AI analysis is advisory; accountable human authorization is required before any safety-critical execution.';
    const result = await this.db.query(
      `INSERT INTO agent_human_approval(id,thread_id,action_type,summary,reason,risk_level,scope_projects,requested_by)
       VALUES($1,$2,$3,$4,$5,'CRITICAL',$6,$7) RETURNING *`,
      [randomUUID(), threadId, actionType, summary, reason,scope,p.userId]
    );
    return map(result.rows[0]);
  }
  async resolve(approvalId: string, threadId: string, decision: HumanDecision, note?: string, resolvedByUserId?: string): Promise<ApprovalRequest> {
    const p=this.owner();assertPermission(p,'HITL_APPROVE','loto','resolve');
    if(resolvedByUserId!==p.userId)denyAccess(p,'RESOURCE_OWNERSHIP_DENIED','loto','resolve');
    const existing=await this.db.query('SELECT requested_by,scope_projects FROM agent_human_approval WHERE id=$1 AND thread_id=$2',[approvalId,threadId]);
    if(!existing.rows.length)throw new AuthorizationError(undefined,'RESOURCE_NOT_FOUND');
    const resource=existing.rows[0];
    if(resource.requested_by!==p.userId)denyAccess(p,'RESOURCE_OWNERSHIP_DENIED','loto','resolve');
    if(!Array.isArray(resource.scope_projects)||!resource.scope_projects.length)denyAccess(p,'PROJECT_SCOPE_DENIED','loto','resolve');
    resource.scope_projects.forEach((code:string)=>assertProjectAccess(p,code));
    const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const safeNote = note?.replace(/\s+/g, ' ').trim().slice(0, 500) || null;
    const result = await this.db.query(
      `UPDATE agent_human_approval SET status=$3,resolved_at=now(),resolution_note=$4,resolved_by_user_id=$5
       WHERE id=$1 AND thread_id=$2 AND status='PENDING' AND requested_by=$5 AND EXISTS(SELECT 1 FROM agent_thread_state ts WHERE ts.thread_id=agent_human_approval.thread_id AND ts.user_id=$5)
       AND EXISTS(SELECT 1 FROM app_user au WHERE au.id=$5 AND au.active=true AND au.role IN('ADMIN','HSE_MANAGER','APPROVER')
         AND NOT EXISTS(SELECT 1 FROM unnest(scope_projects) sp(project) WHERE NOT EXISTS(SELECT 1 FROM projects pr WHERE pr.code=sp.project)
           OR (au.role<>'ADMIN' AND NOT EXISTS(SELECT 1 FROM app_user_project ap WHERE ap.user_id=au.id AND ap.project_code=sp.project)))) RETURNING *`,
      [approvalId, threadId, status, safeNote, resolvedByUserId ?? null]
    );
    if (!result.rowCount) throw new ApprovalResolutionError('Approval is not pending for this thread');
    return map(result.rows[0]);
  }
  async get(approvalId: string): Promise<ApprovalRequest | null> {
    const p=this.owner();assertPermission(p,'AI_USE','loto','read');
    const result = await this.db.query(`SELECT a.* FROM agent_human_approval a
      WHERE a.id=$1 AND a.requested_by=$2
      AND cardinality(a.scope_projects)>0
      AND EXISTS(SELECT 1 FROM agent_thread_state ts WHERE ts.thread_id=a.thread_id AND ts.user_id=$2)
      AND EXISTS(SELECT 1 FROM app_user au WHERE au.id=$2 AND au.active=true
        AND NOT EXISTS(SELECT 1 FROM unnest(a.scope_projects) sp(project)
          WHERE NOT EXISTS(SELECT 1 FROM projects pr WHERE pr.code=sp.project)
          OR (au.role<>'ADMIN' AND NOT EXISTS(SELECT 1 FROM app_user_project ap WHERE ap.user_id=au.id AND ap.project_code=sp.project))))`, [approvalId,p.userId]);
    return result.rowCount ? map(result.rows[0]) : null;
  }
  async deleteForTest(approvalId: string) { await this.db.query('DELETE FROM agent_human_approval WHERE id=$1', [approvalId]); }
}
