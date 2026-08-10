import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { pool } from '../../db/pool';
import type { ApprovalActionType, ApprovalRequest, HumanDecision } from './hitl.types';

export class ApprovalResolutionError extends Error {}

function map(row: any): ApprovalRequest {
  return { approvalId: row.id, threadId: row.thread_id, actionType: row.action_type, summary: row.summary, reason: row.reason, riskLevel: row.risk_level, status: row.status, requestedAt: row.created_at.toISOString(), ...(row.resolved_at ? { resolvedAt: row.resolved_at.toISOString() } : {}), ...(row.resolution_note ? { resolutionNote: row.resolution_note } : {}) };
}

export class PostgresApprovalService {
  constructor(private readonly db: Pool = pool) {}
  async create(threadId: string, actionType: ApprovalActionType): Promise<ApprovalRequest> {
    const summary = 'LOTO safety execution approval requested';
    const reason = 'AI analysis is advisory; accountable human authorization is required before any safety-critical execution.';
    const result = await this.db.query(
      `INSERT INTO agent_human_approval(id,thread_id,action_type,summary,reason,risk_level)
       VALUES($1,$2,$3,$4,$5,'CRITICAL') RETURNING *`,
      [randomUUID(), threadId, actionType, summary, reason]
    );
    return map(result.rows[0]);
  }
  async resolve(approvalId: string, threadId: string, decision: HumanDecision, note?: string): Promise<ApprovalRequest> {
    const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const safeNote = note?.replace(/\s+/g, ' ').trim().slice(0, 500) || null;
    const result = await this.db.query(
      `UPDATE agent_human_approval SET status=$3,resolved_at=now(),resolution_note=$4
       WHERE id=$1 AND thread_id=$2 AND status='PENDING' RETURNING *`,
      [approvalId, threadId, status, safeNote]
    );
    if (!result.rowCount) throw new ApprovalResolutionError('Approval is not pending for this thread');
    return map(result.rows[0]);
  }
  async get(approvalId: string): Promise<ApprovalRequest | null> {
    const result = await this.db.query('SELECT * FROM agent_human_approval WHERE id=$1', [approvalId]); return result.rowCount ? map(result.rows[0]) : null;
  }
  async deleteForTest(approvalId: string) { await this.db.query('DELETE FROM agent_human_approval WHERE id=$1', [approvalId]); }
}

export const humanApprovalService = new PostgresApprovalService();
