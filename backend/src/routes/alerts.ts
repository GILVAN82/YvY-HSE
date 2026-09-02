import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { hasPermission } from '../auth/authorization';
import { ACTION_OVERDUE_SQL } from '../domain/actions';
import { evaluateAlerts } from '../ai/alerts/alert.evaluator';
import { PostgresAlertRepository } from '../ai/alerts/alert.repository';

export function createAlertsRouter(db: Pool) {
  const router = Router(); const repo = new PostgresAlertRepository(db);
  router.get('/ai/alerts', async (req, res) => {
    const principal = (req as unknown as AuthenticatedRequest).principal;
    if (!hasPermission(principal, 'AI_USE')) { res.status(403).json({ error: 'Access denied.' }); return; }
    try {
      const scoped = hasPermission(principal, 'ADMIN_ACCESS') ? [] : principal.allowedProjectIds;
      const actions = await db.query(`SELECT action_id,action_description,priority,status,FLOOR(EXTRACT(EPOCH FROM(CURRENT_TIMESTAMP-target_date))/86400)::int days_overdue FROM action_tracker_capa WHERE ${ACTION_OVERDUE_SQL} ${scoped.length ? 'AND project=ANY($1::text[])' : ''}`, scoped.length ? [scoped] : []);
      const approvals = await db.query(`SELECT a.id,a.summary,a.risk_level,a.status FROM agent_human_approval a JOIN agent_thread_state t ON t.thread_id=a.thread_id WHERE t.user_id=$1 AND a.status='PENDING'`, [principal.userId]);
      const candidates = evaluateAlerts({ actions: actions.rows.map(row => ({ actionId: row.action_id, description: row.action_description, priority: row.priority, status: row.status, daysOverdue: Number(row.days_overdue) })), approvals: approvals.rows.map(row => ({ approvalId: row.id, summary: row.summary, riskLevel: row.risk_level, status: row.status })) });
      await repo.sync(principal.userId, candidates); res.json({ alerts: await repo.list(principal.userId), evaluatedAt: new Date().toISOString() });
    } catch { res.status(503).json({ error: 'Proactive attention is temporarily unavailable.', code: 'ALERT_EVALUATION_UNAVAILABLE' }); }
  });
  router.post('/ai/alerts/:id/acknowledge', async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id); if (!id.success) { res.status(400).json({ error: 'Invalid alert.' }); return; }
    const principal = (req as unknown as AuthenticatedRequest).principal; const alert = await repo.acknowledge(principal.userId, id.data);
    if (!alert) { res.status(404).json({ error: 'Alert is unavailable.' }); return; } res.json({ alert });
  });
  return router;
}
