import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { buildFilter, findTable, TableMeta } from './generic';

export const statsRouter = Router();

/**
 * A KPI card shown above a sheet's table. `fmt` tells the frontend how to render
 * `value` (locale-aware); `tone` drives the colored top border (green/amber/red/blue).
 */
export interface StatCard {
  label: string;
  value: number | string | null;
  tone?: 'g' | 'a' | 'r' | 'b';
  fmt?: 'int' | 'dec2' | 'pct' | 'date' | 'text';
  /** Static, translatable sub-label. Never interpolate values into it — use hintNum. */
  hint?: string;
  /** Appended to the hint, formatted by the frontend in the active locale. */
  hintNum?: number;
}

// Same status vocabulary the frontend uses for row badges, reused here to bucket
// arbitrary sheets into closed / in-progress / overdue counts.
const GREEN = new Set(['Closed', 'Completed', 'Active', 'Valid', 'Pass', 'Compliant', 'Yes', 'Safe Behavior', 'Low', 'Approved', 'Good']);
const AMBER = new Set(['In Progress', 'Open', 'Planned', 'Pending', 'Conditional Pass', 'Expiring Soon', 'Medium', 'On Hold', 'Under Review', 'Delayed', 'Caution']);
const RED = new Set(['Overdue', 'Expired', 'Fail', 'Non-Compliant', 'Extreme', 'High', 'Cancelled', 'Rejected', 'Unsafe Behavior', 'Unsafe Condition', 'Suspended']);

const DAY = 86400000;
const MAX_ROWS = 5000; // sheets are small; guards against a runaway scan

type Row = Record<string, any>;
interface Ctx {
  sheet: string;
  ti: number;
  t: TableMeta;
  rows: Row[];
  total: number;
  project: string;
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function date(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function count(rows: Row[], fn: (r: Row) => boolean): number {
  return rows.filter(fn).length;
}
function avg(rows: Row[], col: string): number | null {
  const vals = rows.map(r => num(r[col])).filter((n): n is number => n !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
function sum(rows: Row[], col: string): number {
  return rows.reduce((a, r) => a + (num(r[col]) ?? 0), 0);
}
function latest(rows: Row[], col: string): Date | null {
  let best: Date | null = null;
  for (const r of rows) {
    const d = date(r[col]);
    if (d && (!best || d > best)) best = d;
  }
  return best;
}
/** Score columns are stored either as 0-1 fractions or 0-100 — normalise to a percentage card. */
function scoreCard(label: string, v: number | null, goodAt = 0.85, okAt = 0.72, hint?: string): StatCard {
  if (v === null) return { label, value: null, fmt: 'pct', hint };
  const frac = v > 1.5 ? v / 100 : v;
  return { label, value: frac, fmt: 'pct', tone: frac >= goodAt ? 'g' : frac >= okAt ? 'a' : 'r', hint };
}
function totalCard(total: number): StatCard {
  return { label: 'Total Records', value: total, tone: 'b', fmt: 'int' };
}

async function rateBase(): Promise<number> {
  const r = await pool.query(`SELECT value FROM settings WHERE named_range = 'RateBase'`);
  const v = num(r.rows[0]?.value);
  return v ?? 1000000;
}

/** Man-hours for the current project scope — the denominator for TRIR/LTIFR. */
async function manHours(project: string): Promise<number> {
  const params: any[] = [];
  let where = '';
  if (project) {
    params.push(project);
    where = 'WHERE project_code = $1';
  }
  const r = await pool.query(`SELECT COALESCE(SUM(total_manhours),0) AS mh FROM manpower_log ${where}`, params);
  return Number(r.rows[0].mh);
}

// ---------------------------------------------------------------------------
// Per-sheet KPI definitions. Anything not listed here falls through to
// genericCards() below, so all 35 sheets get a KPI strip either way.
// ---------------------------------------------------------------------------

const SPECS: Record<string, (c: Ctx) => Promise<StatCard[]> | StatCard[]> = {
  'Incident Register#0': async c => {
    const recordable = count(c.rows, r => r['incident_type'] !== 'Near Miss');
    const lti = count(c.rows, r => r['incident_type'] === 'Lost Time Injury');
    const nearMiss = count(c.rows, r => r['incident_type'] === 'Near Miss');
    const rb = await rateBase();
    const mh = await manHours(c.project);
    const trir = mh > 0 ? (recordable * rb) / mh : null;
    // "Days since LTI" is a project-scope milestone, not a property of the filtered
    // subset — it comes from the last LTI on record for the selected project.
    const lastLti = await pool.query(
      `SELECT MAX(date_of_incident) AS last FROM incident_register WHERE incident_type = 'Lost Time Injury'` +
        (c.project ? ' AND project_code = $1' : ''),
      c.project ? [c.project] : []
    );
    const last = date(lastLti.rows[0]?.last);
    return [
      totalCard(c.total),
      { label: 'Recordable Incidents', value: recordable, tone: recordable ? 'r' : 'g', fmt: 'int' },
      { label: 'Lost Time Injuries', value: lti, tone: lti ? 'r' : 'g', fmt: 'int' },
      { label: 'Near Misses', value: nearMiss, tone: 'a', fmt: 'int' },
      { label: 'Lost Days', value: sum(c.rows, 'lost_days'), tone: 'a', fmt: 'int' },
      { label: 'TRIR', value: trir, fmt: 'dec2', tone: trir === null ? undefined : trir > 1 ? 'r' : 'g', hint: 'Rate base (man-hours)', hintNum: rb },
      { label: 'Days Since LTI', value: last ? Math.floor((Date.now() - last.getTime()) / DAY) : null, fmt: 'int', tone: 'b', hint: 'Project scope — not affected by filters' },
    ];
  },

  'Action Tracker (CAPA)#0': c => {
    const now = Date.now();
    const openRows = c.rows.filter(r => r['status'] !== 'Closed');
    const overdue = count(openRows, r => {
      const d = date(r['target_date']);
      return !!d && d.getTime() < now;
    });
    const dueSoon = count(openRows, r => {
      const d = date(r['target_date']);
      return !!d && d.getTime() >= now && d.getTime() - now <= 30 * DAY;
    });
    const closed = count(c.rows, r => r['status'] === 'Closed');
    const highPri = count(openRows, r => r['priority'] === 'High' || r['priority'] === 'Critical');
    return [
      totalCard(c.total),
      { label: 'Open Actions', value: openRows.length - overdue, tone: 'a', fmt: 'int' },
      { label: 'Overdue Actions', value: overdue, tone: overdue ? 'r' : 'g', fmt: 'int' },
      { label: 'Due in 30 Days', value: dueSoon, tone: 'a', fmt: 'int' },
      { label: 'High/Critical Open', value: highPri, tone: highPri ? 'r' : 'g', fmt: 'int' },
      { label: 'Closed Actions', value: closed, tone: 'g', fmt: 'int' },
    ];
  },

  'Training & Competency#0': c => {
    const now = Date.now();
    const valid = count(c.rows, r => r['status'] === 'Valid');
    const expired = count(c.rows, r => {
      const d = date(r['expiry_date']);
      return r['status'] === 'Expired' || (!!d && d.getTime() < now);
    });
    const expiring = count(c.rows, r => {
      const d = date(r['expiry_date']);
      return !!d && d.getTime() >= now && d.getTime() - now <= 30 * DAY;
    });
    const pct = c.rows.length ? valid / c.rows.length : null;
    return [
      totalCard(c.total),
      scoreCard('Training Compliance', pct, 0.9, 0.72),
      { label: 'Valid Certificates', value: valid, tone: 'g', fmt: 'int' },
      { label: 'Expiring in 30 Days', value: expiring, tone: expiring ? 'a' : 'g', fmt: 'int' },
      { label: 'Expired', value: expired, tone: expired ? 'r' : 'g', fmt: 'int' },
      { label: 'People Trained', value: new Set(c.rows.map(r => r['employee_id'] || r['employee_name']).filter(Boolean)).size, tone: 'b', fmt: 'int' },
    ];
  },

  'Permit to Work Register#0': c => {
    const active = count(c.rows, r => r['status'] === 'Active' || r['status'] === 'Open');
    const closed = count(c.rows, r => r['status'] === 'Closed');
    const gasTests = count(c.rows, r => r['gas_test_required'] === 'Yes');
    return [
      totalCard(c.total),
      { label: 'Active Permits', value: active, tone: 'a', fmt: 'int' },
      { label: 'Closed Permits', value: closed, tone: 'g', fmt: 'int' },
      { label: 'Gas Test Required', value: gasTests, tone: 'b', fmt: 'int' },
      { label: 'Permit Types', value: new Set(c.rows.map(r => r['permit_type']).filter(Boolean)).size, tone: 'b', fmt: 'int' },
      { label: 'Latest Issue', value: latest(c.rows, 'issue_datetime')?.toISOString() ?? null, fmt: 'date', tone: 'b' },
    ];
  },

  'Audit Tracker#0': c => [
    totalCard(c.total),
    scoreCard('Average Audit Score', avg(c.rows, 'overall_audit_score')),
    { label: 'Total Findings', value: sum(c.rows, 'number_of_findings'), tone: 'a', fmt: 'int' },
    { label: 'Audit Types', value: new Set(c.rows.map(r => r['audit_type']).filter(Boolean)).size, tone: 'b', fmt: 'int' },
    { label: 'Latest Audit', value: latest(c.rows, 'audit_date')?.toISOString() ?? null, fmt: 'date', tone: 'b' },
  ],

  'Audit Tracker#1': c => {
    const open = count(c.rows, r => r['status'] !== 'Closed');
    const major = count(c.rows, r => /major|critical/i.test(String(r['classification'] ?? '')));
    return [
      totalCard(c.total),
      { label: 'Open Findings', value: open, tone: open ? 'a' : 'g', fmt: 'int' },
      { label: 'Major/Critical', value: major, tone: major ? 'r' : 'g', fmt: 'int' },
      { label: 'Closed Findings', value: c.rows.length - open, tone: 'g', fmt: 'int' },
    ];
  },

  'Safety Observations (BBS)#0': c => {
    const unsafe = count(c.rows, r => /unsafe/i.test(String(r['observation_type'] ?? '')));
    const safe = count(c.rows, r => /safe behavior/i.test(String(r['observation_type'] ?? '')));
    const open = count(c.rows, r => r['status'] && r['status'] !== 'Closed');
    const highRisk = count(c.rows, r => r['risk_level'] === 'High' || r['risk_level'] === 'Extreme');
    return [
      totalCard(c.total),
      { label: 'Unsafe Observations', value: unsafe, tone: unsafe ? 'r' : 'g', fmt: 'int' },
      { label: 'Safe Behaviors', value: safe, tone: 'g', fmt: 'int' },
      { label: 'High/Extreme Risk', value: highRisk, tone: highRisk ? 'r' : 'g', fmt: 'int' },
      { label: 'Open Observations', value: open, tone: open ? 'a' : 'g', fmt: 'int' },
    ];
  },

  'HIRA Register#0': c => {
    const high = count(c.rows, r => r['risk_level'] === 'High' || r['risk_level'] === 'Extreme');
    const residualHigh = count(c.rows, r => r['residual_risk_level'] === 'High' || r['residual_risk_level'] === 'Extreme');
    const now = Date.now();
    const reviewDue = count(c.rows, r => {
      const d = date(r['review_date']);
      return !!d && d.getTime() - now <= 30 * DAY;
    });
    return [
      totalCard(c.total),
      { label: 'High/Extreme Risk', value: high, tone: high ? 'r' : 'g', fmt: 'int' },
      { label: 'Residual High/Extreme', value: residualHigh, tone: residualHigh ? 'r' : 'g', fmt: 'int' },
      { label: 'Risk Reduced', value: high - residualHigh, tone: 'g', fmt: 'int', hint: 'high/extreme hazards brought down by controls' },
      { label: 'Review Due in 30 Days', value: reviewDue, tone: reviewDue ? 'a' : 'g', fmt: 'int' },
    ];
  },

  'Manpower Log#0': c => {
    const mh = sum(c.rows, 'total_manhours');
    const workers = sum(c.rows, 'number_of_workers');
    return [
      totalCard(c.total),
      { label: 'Total Man-Hours', value: mh, tone: 'b', fmt: 'int' },
      { label: 'Worker-Entries', value: workers, tone: 'b', fmt: 'int' },
      { label: 'Avg Hours/Worker', value: workers ? mh / workers : null, tone: 'b', fmt: 'dec2' },
      { label: 'Contractors', value: new Set(c.rows.map(r => r['contractorcompany']).filter(Boolean)).size, tone: 'b', fmt: 'int' },
      { label: 'Latest Entry', value: latest(c.rows, 'date')?.toISOString() ?? null, fmt: 'date', tone: 'b' },
    ];
  },

  'Chemical Inventory & MSDS#0': c => {
    const noMsds = count(c.rows, r => r['msds_on_file'] !== 'Yes');
    return [
      totalCard(c.total),
      { label: 'MSDS on File', value: c.rows.length - noMsds, tone: 'g', fmt: 'int' },
      { label: 'Missing MSDS', value: noMsds, tone: noMsds ? 'r' : 'g', fmt: 'int' },
      { label: 'Hazard Classes', value: new Set(c.rows.map(r => r['ghs_hazard_class']).filter(Boolean)).size, tone: 'a', fmt: 'int' },
      { label: 'Quantity on Site', value: sum(c.rows, 'quantity_on_site'), tone: 'b', fmt: 'dec2', hint: 'mixed units — see the Unit column' },
    ];
  },

  'Spill Environmental Incident#0': c => {
    const reported = count(c.rows, r => r['reported_to_authority'] === 'Yes');
    const open = count(c.rows, r => r['status'] && r['status'] !== 'Closed');
    return [
      totalCard(c.total),
      { label: 'Open Spills', value: open, tone: open ? 'r' : 'g', fmt: 'int' },
      { label: 'Reported to Authority', value: reported, tone: reported ? 'r' : 'g', fmt: 'int' },
      { label: 'Quantity Spilled', value: sum(c.rows, 'quantity_spilled'), tone: 'a', fmt: 'dec2', hint: 'mixed units — see the Unit column' },
      { label: 'Latest Spill', value: latest(c.rows, 'datetime')?.toISOString() ?? null, fmt: 'date', tone: 'b' },
    ];
  },

  'Toolbox Talks#0': c => [
    totalCard(c.total),
    { label: 'Total Attendees', value: sum(c.rows, 'number_of_attendees'), tone: 'g', fmt: 'int' },
    { label: 'Avg Attendance', value: avg(c.rows, 'number_of_attendees'), tone: 'b', fmt: 'dec2' },
    { label: 'Distinct Topics', value: new Set(c.rows.map(r => r['topic']).filter(Boolean)).size, tone: 'b', fmt: 'int' },
    { label: 'Latest Talk', value: latest(c.rows, 'date')?.toISOString() ?? null, fmt: 'date', tone: 'b' },
  ],
};

// ---------------------------------------------------------------------------
// Generic fallback — derives cards from column shape alone, so a sheet with no
// hand-written spec still gets a meaningful strip.
// ---------------------------------------------------------------------------

const EXPIRY_RE = /expiry|expire|due|next_review|next_maintenance|replacement|review_date|target_date|target_close/;
const SCORE_RE = /score|prequalification|compliance/;

function genericCards(c: Ctx): StatCard[] {
  const { t, rows } = c;
  const cards: StatCard[] = [totalCard(c.total)];

  const statusCol = t.columns.find(col => col.name === 'status') || t.columns.find(col => col.name.includes('status'));
  if (statusCol) {
    let g = 0, a = 0, r = 0;
    for (const row of rows) {
      const v = String(row[statusCol.name] ?? '');
      if (GREEN.has(v)) g++;
      else if (RED.has(v)) r++;
      else if (AMBER.has(v)) a++;
    }
    if (a) cards.push({ label: 'Open / In Progress', value: a, tone: 'a', fmt: 'int' });
    if (r) cards.push({ label: 'Overdue / Failed', value: r, tone: 'r', fmt: 'int' });
    if (g) cards.push({ label: 'Closed / Valid', value: g, tone: 'g', fmt: 'int' });
  }

  const expCol = t.columns.find(col => col.type === 'DATE' && EXPIRY_RE.test(col.name));
  if (expCol) {
    const now = Date.now();
    let expired = 0, soon = 0;
    for (const row of rows) {
      const d = date(row[expCol.name]);
      if (!d) continue;
      if (d.getTime() < now) expired++;
      else if (d.getTime() - now <= 30 * DAY) soon++;
    }
    cards.push({ label: 'Due in 30 Days', value: soon, tone: soon ? 'a' : 'g', fmt: 'int', hint: expCol.header });
    cards.push({ label: 'Past Due', value: expired, tone: expired ? 'r' : 'g', fmt: 'int', hint: expCol.header });
  }

  // Labels stay static so they resolve in the translation dictionaries; the column
  // name rides along in `hint`, which is already translated as a table header.
  const scoreCol = t.columns.find(col => col.type === 'NUMERIC' && SCORE_RE.test(col.name));
  if (scoreCol) cards.push(scoreCard('Average Score', avg(rows, scoreCol.name), 0.85, 0.72, scoreCol.header));

  // Still thin? Fall back to breadth-of-data cards that almost every sheet supports.
  if (cards.length < 4) {
    const prjCol = t.columns.find(col => /^project(_code)?$/.test(col.name));
    if (prjCol && !c.project) {
      cards.push({ label: 'Projects Covered', value: new Set(rows.map(r => r[prjCol.name]).filter(Boolean)).size, tone: 'b', fmt: 'int' });
    }
    const numCol = t.columns.find(col => col.type === 'NUMERIC' && col.name !== 'id' && (!scoreCol || col.name !== scoreCol.name));
    if (numCol) cards.push({ label: 'Column Total', value: sum(rows, numCol.name), tone: 'b', fmt: 'dec2', hint: numCol.header });
    const dateCol = t.columns.find(col => col.type === 'DATE');
    if (dateCol) cards.push({ label: 'Latest Entry', value: latest(rows, dateCol.name)?.toISOString() ?? null, fmt: 'date', tone: 'b' });
  }

  return cards;
}

/**
 * GET /api/stats/:sheet/:tableIndex?  -> KPI cards for a sheet page.
 * Accepts the same q/project/status filters as /api/data, so the cards and the
 * table underneath always describe the same set of rows.
 */
statsRouter.get('/stats/:sheet/:tableIndex(\\d+)?', async (req: Request, res: Response) => {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = req.params.tableIndex ? Number(req.params.tableIndex) : 0;
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const { whereSql, params } = buildFilter(t, req.query as Record<string, string>);
  const countRes = await pool.query(`SELECT COUNT(*) FROM "${t.db_table}" ${whereSql}`, params);
  const total = Number(countRes.rows[0].count);
  const rowsRes = await pool.query(`SELECT * FROM "${t.db_table}" ${whereSql} LIMIT ${MAX_ROWS}`, params);

  const ctx: Ctx = { sheet, ti, t, rows: rowsRes.rows, total, project: (req.query.project as string) || '' };
  const spec = SPECS[`${sheet}#${ti}`];
  const cards = spec ? await spec(ctx) : genericCards(ctx);

  res.json({
    sheet,
    tableIndex: ti,
    total,
    truncated: total > MAX_ROWS,
    cards: cards.filter(c => c.value !== null && c.value !== undefined),
  });
});
