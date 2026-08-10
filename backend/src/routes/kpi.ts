import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { isActionOverdue } from '../domain/actions';

export const kpiRouter = Router();

async function getRateBase(): Promise<number> {
  const r = await pool.query(`SELECT value FROM settings WHERE named_range = 'RateBase'`);
  const v = r.rows[0]?.value ? Number(r.rows[0].value) : 1000000;
  return isNaN(v) ? 1000000 : v;
}

function monthFilter(monthIdx: number | undefined, dateCol: string, params: any[]): string {
  if (monthIdx === undefined || monthIdx === null || isNaN(monthIdx)) return '';
  params.push(monthIdx + 1);
  return ` AND EXTRACT(MONTH FROM "${dateCol}") = $${params.length}`;
}

/** Core KPI calculation, shared by the /api/kpi route and the AI chat tool. */
export async function computeKpi(project: string, monthIdx: number | undefined) {
  const rateBase = await getRateBase();

  const prjParams: any[] = [];
  let prjWhere = '';
  if (project && project !== '*') {
    prjParams.push(project);
    prjWhere = ` AND project_code = $${prjParams.length}`;
  }

  // Man-hours
  {
    const params = [...prjParams];
    const mf = monthFilter(monthIdx, 'date', params);
    const r = await pool.query(
      `SELECT COALESCE(SUM(total_manhours),0) AS mh FROM manpower_log WHERE 1=1 ${prjWhere.replace('project_code','project_code')} ${mf}`,
      params
    );
    var mh = Number(r.rows[0].mh);
  }

  // Incidents (excluding Near Miss = recordable)
  const incParams: any[] = [...prjParams];
  const incMf = monthFilter(monthIdx, 'date_of_incident', incParams);
  const incRows = await pool.query(
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
  const actParams: any[] = [];
  let actWhere = '';
  if (project && project !== '*') {
    actParams.push(project);
    actWhere = ` WHERE project = $1`;
  }
  const actRows = await pool.query(
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
  if (project && project !== '*') {
    permParams.push(project);
    permWhere += ` AND project = $${permParams.length}`;
  }
  const permRows = await pool.query(`SELECT id FROM permit_to_work_register ${permWhere}`, permParams);

  // Training %
  const trainParams: any[] = [];
  let trainWhere = '';
  if (project && project !== '*') {
    trainParams.push(project);
    trainWhere = `WHERE project = $1`;
  }
  const trainRows = await pool.query(`SELECT status FROM training_competency ${trainWhere}`, trainParams);
  const trainingPct = trainRows.rows.length
    ? trainRows.rows.filter(r => r.status === 'Valid').length / trainRows.rows.length
    : null;

  // Audit score average
  const auditParams: any[] = [];
  let auditWhere = '';
  if (project && project !== '*') {
    auditParams.push(project);
    auditWhere = `WHERE project = $1`;
  }
  const auditRows = await pool.query(
    `SELECT AVG(overall_audit_score) AS avg FROM audit_tracker ${auditWhere}`,
    auditParams
  );
  const auditScore = auditRows.rows[0].avg !== null ? Number(auditRows.rows[0].avg) : null;

  // Days since last LTI
  const ltiParams: any[] = [...prjParams];
  const ltiRows = await pool.query(
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
  res.json(await computeKpi(project, monthIdx));
});
