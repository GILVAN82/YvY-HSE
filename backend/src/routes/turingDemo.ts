import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { AuthenticatedRequest, RequestPrincipal } from '../auth/auth.types';
import { canAccessProject, hasPermission } from '../auth/authorization';
import { PostgresApprovalService } from '../ai/hitl/hitl.repository';
import { listProvidersForClient } from '../ai/providers';

export interface DemoConfiguration { enabled: boolean; safeDataDeclared: boolean; project: string | null }
export function readDemoConfiguration(env = process.env): DemoConfiguration {
  return { enabled: env.TURING_DEMO_MODE === 'true', safeDataDeclared: env.TURING_DEMO_SAFE_DATA === 'true',
    project: /^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(env.TURING_DEMO_PROJECT ?? '') ? env.TURING_DEMO_PROJECT! : null };
}
export interface DemoProbe { agent: boolean; rag: boolean; operational: boolean; approval: unknown; voice: 'CONFIGURED' | 'DEGRADED' }
export function productionDemoProbe(db: Pick<Pool, 'query'>) {
  return async (principal: RequestPrincipal, config: DemoConfiguration, threadId?: string): Promise<DemoProbe> => {
    const identity = await db.query('SELECT current_database() AS name');
    // Operator attestation is required even for the dedicated synthetic database. No customer data is sampled.
    const safe = config.safeDataDeclared && identity.rows[0]?.name === 'hse_app_demo' && !!config.project && canAccessProject(principal, config.project);
    const projects = safe ? await db.query('SELECT code FROM projects WHERE code=$1', [config.project]) : { rows: [] };
    const rag = await db.query('SELECT EXISTS(SELECT 1 FROM rag_documents d JOIN rag_chunks c ON c.document_id=d.id) AS available');
    let approval = null;
    if (safe && projects.rows.length) {
      const candidates = await db.query(`SELECT id FROM agent_human_approval WHERE requested_by=$1
        AND ($2::uuid IS NULL AND status='PENDING' OR thread_id=$2::uuid)
        AND $3=ANY(scope_projects) ORDER BY created_at DESC LIMIT 1`, [principal.userId, threadId ?? null, config.project]);
      if (candidates.rows[0]) {
        const item = await new PostgresApprovalService(db, principal).get(candidates.rows[0].id);
        if (item) { const { resolutionNote, summary, reason, ...safeItem } = item; approval = safeItem; }
      }
    }
    return { agent: listProvidersForClient().some(p => p.available) && (process.env.AI_ORCHESTRATOR ?? 'langgraph') === 'langgraph',
      rag: rag.rows[0]?.available === true, operational: safe && projects.rows.length > 0, approval,
      voice: process.env.ELEVENLABS_API_KEY ? 'CONFIGURED' : 'DEGRADED' };
  };
}
export function createTuringDemoRouter(probe: ReturnType<typeof productionDemoProbe>, readConfig = readDemoConfiguration) {
  const router = Router();
  router.use('/ai/turing-demo', (req, res, next) => {
    const principal = (req as AuthenticatedRequest).principal;
    if (!principal) { res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' }); return; }
    if (!hasPermission(principal, 'AI_USE')) { res.status(403).json({ code: 'PERMISSION_DENIED' }); return; }
    next();
  });
  router.get('/ai/turing-demo/config', (_req, res) => res.json({ enabled: readConfig().enabled }));
  router.get('/ai/turing-demo/preflight', async (req, res) => {
    const config = readConfig();
    if (!config.enabled) { res.status(404).json({ code: 'DEMO_DISABLED' }); return; }
    const parsed = z.object({ threadId: z.uuid().optional() }).strict().safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ code: 'INVALID_REQUEST' }); return; }
    try {
      const principal = (req as AuthenticatedRequest).principal;
      const result = await probe(principal, config, parsed.data.threadId);
      res.json({ ...result, authenticated: true, routes: true, inspector: true,
        project: result.operational ? config.project : null, canApprove: hasPermission(principal, 'HITL_APPROVE'),
        status: !result.agent ? 'BLOCKED' : result.rag && result.operational && result.voice === 'CONFIGURED' ? 'READY' : 'READY_WITH_WARNINGS' });
    } catch { res.status(503).json({ status: 'BLOCKED', code: 'DEMO_PREFLIGHT_UNAVAILABLE' }); }
  });
  return router;
}
