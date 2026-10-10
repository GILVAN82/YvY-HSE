import { isActionOverdue } from '../domain/actions';
import type { RequestPrincipal } from '../auth/auth.types';
import { assertProjectAccess, hasPermission } from '../auth/authorization';

export interface KpiQueryExecutor {
  query: (text: string, values?: any[]) => Promise<{ rows: any[] }>;
}

async function getRateBase(database: KpiQueryExecutor): Promise<number> {
  const r = await database.query(`SELECT value FROM settings WHERE named_range = 'RateBase'`);
  const v = r.rows[0]?.value ? Number(r.rows[0].value) : 1000000;
  return isNaN(v) ? 1000000 : v;
}

function monthFilter(monthIdx: number | undefined, dateCol: string, params: any[]): string {
  if (monthIdx === undefined || monthIdx === null || isNaN(monthIdx)) return '';
  params.push(monthIdx + 1);
  return ` AND EXTRACT(MONTH FROM "${dateCol}") = $${params.length}`;
}

/** Reusable KPI calculation. Production and tests must provide an explicit query executor. */
export async function computeKpi(
  project: string,
  monthIdx: number | undefined,
  principal: RequestPrincipal | undefined,
  database: KpiQueryExecutor
) {
  if (principal && project && project !== '*') assertProjectAccess(principal, project);
  const rateBase = await getRateBase(database);
  const allowed = principal && !hasPermission(principal, 'ADMIN_ACCESS') ? principal.allowedProjectIds : null;
  const scope = (column: string, params: any[]) => {
    if (project && project !== '*') { params.push(project); return ` AND ${column}=$${params.length}`; }
    if (allowed) { params.push(allowed); return ` AND ${column}=ANY($${params.length}::text[])`; }
    return '';
  };

  const prjParams: any[] = [];
  const prjWhere = scope('project_code', prjParams);

  const params = [...prjParams];
  const mf = monthFilter(monthIdx, 'date', params);
  const manHours = await database.query(
    `SELECT COALESCE(SUM(total_manhours),0) AS mh FROM manpower_log WHERE 1=1 ${prjWhere} ${mf}`,
    params
  );
  const mh = Number(manHours.rows[0].mh);

  const incParams: any[] = [...prjParams];
  const incMf = monthFilter(monthIdx, 'date_of_incident', incParams);
  const incRows = await database.query(
    `SELECT severity, incident_type FROM incident_register WHERE 1=1 ${prjWhere} ${incMf}`,
    incParams
  );
  const totalInc = incRows.rows.length;
  const recordable = incRows.rows.filter((r) => r.incident_type !== 'Near Miss').length;
  const lti = incRows.rows.filter((r) => r.incident_type === 'Lost Time Injury').length;

  const trir = mh > 0 ? (recordable * rateBase) / mh : null;
  const ltifr = mh > 0 ? (lti * rateBase) / mh : null;

  const actParams: any[] = [];
  const actScope = scope('project', actParams);
  const actWhere = actScope ? ` WHERE 1=1 ${actScope}` : '';
  const actRows = await database.query(`SELECT status, target_date FROM action_tracker_capa ${actWhere}`, actParams);
  const today = new Date();
  let openActions = 0;
  let overdueActions = 0;
  for (const action of actRows.rows) {
    if (action.status === 'Closed') continue;
    if (isActionOverdue(action, today)) overdueActions++;
    else openActions++;
  }

  const permParams: any[] = [];
  let permWhere = `WHERE status IN ('Active','Open')`;
  permWhere += scope('project', permParams);
  const permRows = await database.query(`SELECT id FROM permit_to_work_register ${permWhere}`, permParams);

  const trainParams: any[] = [];
  const trainScope = scope('project', trainParams);
  const trainWhere = trainScope ? `WHERE 1=1 ${trainScope}` : '';
  const trainRows = await database.query(`SELECT status FROM training_competency ${trainWhere}`, trainParams);
  const trainingPct = trainRows.rows.length
    ? trainRows.rows.filter((r) => r.status === 'Valid').length / trainRows.rows.length
    : null;

  const auditParams: any[] = [];
  const auditScope = scope('project', auditParams);
  const auditWhere = auditScope ? `WHERE 1=1 ${auditScope}` : '';
  const auditRows = await database.query(`SELECT AVG(overall_audit_score) AS avg FROM audit_tracker ${auditWhere}`, auditParams);
  const auditScore = auditRows.rows[0].avg !== null ? Number(auditRows.rows[0].avg) : null;

  const ltiParams: any[] = [...prjParams];
  const ltiRows = await database.query(
    `SELECT MAX(date_of_incident) AS last FROM incident_register WHERE incident_type = 'Lost Time Injury' ${prjWhere}`,
    ltiParams
  );
  const lastLti = ltiRows.rows[0].last;
  const daysSinceLTI = lastLti ? Math.floor((today.getTime() - new Date(lastLti).getTime()) / 86400000) : null;

  return {
    project: project || '*', month: monthIdx ?? '*', rateBase, manHours: mh,
    totalIncidents: totalInc, recordableIncidents: recordable, lostTimeInjuries: lti,
    trir, ltifr, openActions, overdueActions, activePermits: permRows.rows.length,
    trainingCompliance: trainingPct, auditScoreAvg: auditScore, daysSinceLTI,
  };
}
