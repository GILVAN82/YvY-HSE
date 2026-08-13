import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { isActionOverdue } from '../domain/actions';
import type { AuthenticatedRequest, RequestPrincipal } from '../auth/auth.types';
import { assertProjectAccess, hasPermission, requirePermission } from '../auth/authorization';

export const kpiRouter = Router();
kpiRouter.use(requirePermission('HSE_DATA_READ'));

async function getRateBase(database:Pick<typeof pool,'query'>=pool):Promise<number> {
  const r = await database.query(`SELECT value FROM settings WHERE named_range = 'RateBase'`);
  const v = r.rows[0]?.value ? Number(r.rows[0].value) : 1000000;
  return isNaN(v) ? 1000000 : v;
}

function monthFilter(monthIdx: number | undefined, dateCol: string, params: any[]): string {
  if (monthIdx === undefined || monthIdx === null || isNaN(monthIdx)) return '';
  params.push(monthIdx + 1);
  return ` AND EXTRACT(MONTH FROM "${dateCol}") = $${params.length}`;
}

/** Core KPI calculation, shared by the /api/kpi route and the AI chat tool. */
export async function computeKpi(project:string,monthIdx:number|undefined,principal?:RequestPrincipal,database:Pick<typeof pool,'query'>=pool) {
  const rateBase = await getRateBase(database);

  if(principal && project && project!=='*') assertProjectAccess(principal,project);
  const allowed=principal && !hasPermission(principal,'ADMIN_ACCESS') ? principal.allowedProjectIds : null;
  const scope=(column:string,params:any[])=>{if(project&&project!=='*'){params.push(project);return ` AND ${column}=$${params.length}`;} if(allowed){params.push(allowed);return ` AND ${column}=ANY($${params.length}::text[])`;} return '';};

  const prjParams:any[]=[]; const prjWhere=scope('project_code',prjParams);

  // Man-hours
  {
    const params = [...prjParams];
    const mf = monthFilter(monthIdx, 'date', params);
    const r = await database.query(
      `SELECT COALESCE(SUM(total_manhours),0) AS mh FROM manpower_log WHERE 1=1 ${prjWhere.replace('project_code','project_code')} ${mf}`,
      params
    );
    var mh = Number(r.rows[0].mh);
  }

  // Incidents (excluding Near Miss = recordable)
  const incParams: any[] = [...prjParams];
  const incMf = monthFilter(monthIdx, 'date_of_incident', incParams);
  const incRows = await database.query(
    `SELECT severity, incident_type FROM incident_register WHERE 1=1 ${prjWhere} ${incMf}`,
    incParams
  );
  const totalInc = incRows.rows.length;
  const recordable = incRows.rows.filter(r => r.incident_type !== 'Near Miss').length;
  const lti = incRows.rows.filter(r => r.incident_type === 'Lost Time Injury').length;

  const trir = mh > 0 ? (recordable * rateBase) / mh : null;
  const ltifr = mh > 0 ? (lti * rateBase) / mh : null;

  // Actions: open/overdue (computed_status column already stores computed value from the sheet;
  // if you want live recompute, replace with a CASE based on target_date < now() and status).
  const actParams:any[]=[]; const actScope=scope('project',actParams); const actWhere=actScope?` WHERE 1=1 ${actScope}`:'';
  const actRows = await database.query(
    `SELECT status, target_date FROM action_tracker_capa ${actWhere}`,
    actParams
  );
  const today = new Date();
  let openActions = 0, overdueActions = 0;
  for (const a of actRows.rows) {
    if (a.status === 'Closed') continue;
    const overdue = isActionOverdue(a, today);
    if (overdue) overdueActions++; else openActions++;
  }

  // Active permits
  const permParams: any[] = [];
  let permWhere = `WHERE status IN ('Active','Open')`;
  permWhere += scope('project',permParams);
  const permRows = await database.query(`SELECT id FROM permit_to_work_register ${permWhere}`,permParams);

  // Training %
  const trainParams: any[] = [];
  const trainScope=scope('project',trainParams); const trainWhere=trainScope?`WHERE 1=1 ${trainScope}`:'';
  const trainRows = await database.query(`SELECT status FROM training_competency ${trainWhere}`,trainParams);
  const trainingPct = trainRows.rows.length
    ? trainRows.rows.filter(r => r.status === 'Valid').length / trainRows.rows.length
    : null;

  // Audit score average
  const auditParams: any[] = [];
  const auditScope=scope('project',auditParams); const auditWhere=auditScope?`WHERE 1=1 ${auditScope}`:'';
  const auditRows = await database.query(
    `SELECT AVG(overall_audit_score) AS avg FROM audit_tracker ${auditWhere}`,
    auditParams
  );
  const auditScore = auditRows.rows[0].avg !== null ? Number(auditRows.rows[0].avg) : null;

  // Days since last LTI
  const ltiParams: any[] = [...prjParams];
  const ltiRows = await database.query(
    `SELECT MAX(date_of_incident) AS last FROM incident_register WHERE incident_type = 'Lost Time Injury' ${prjWhere}`,
    ltiParams
  );
  const lastLti = ltiRows.rows[0].last;
  const daysSinceLTI = lastLti ? Math.floor((today.getTime() - new Date(lastLti).getTime()) / 86400000) : null;

  return {
    project: project || '*',
    month: monthIdx ?? '*',
    rateBase,
    manHours: mh,
    totalIncidents: totalInc,
    recordableIncidents: recordable,
    lostTimeInjuries: lti,
    trir,
    ltifr,
    openActions,
    overdueActions,
    activePermits: permRows.rows.length,
    trainingCompliance: trainingPct,
    auditScoreAvg: auditScore,
    daysSinceLTI,
  };
}

/**
 * GET /api/kpi?project=PRJ-001&month=3   (month is 0-based like the frontend; omit for full year)
 * project omitted or '*' => portfolio-wide
 */
kpiRouter.get('/kpi', async (req: Request, res: Response) => {
  const project = (req.query.project as string) || '';
  const monthQ = req.query.month as string | undefined;
  const monthIdx = monthQ !== undefined && monthQ !== '*' ? Number(monthQ) : undefined;
  res.json(await computeKpi(project,monthIdx,(req as AuthenticatedRequest).principal));
});
