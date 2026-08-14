import { Router, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { requirePermission } from '../auth/authorization';
import { computeKpi, type KpiQueryExecutor } from './kpi.service';

/** Production composition supplies the real pool; importing this module is configuration-free. */
export function createKpiRouter(database: KpiQueryExecutor): Router {
  const router = Router();
  router.use(requirePermission('HSE_DATA_READ'));
  router.get('/kpi', async (req: Request, res: Response) => {
    const project = (req.query.project as string) || '';
    const monthQ = req.query.month as string | undefined;
    const monthIdx = monthQ !== undefined && monthQ !== '*' ? Number(monthQ) : undefined;
    res.json(await computeKpi(project, monthIdx, (req as AuthenticatedRequest).principal, database));
  });
  return router;
}
