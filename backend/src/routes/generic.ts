import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import tableMeta from '../config/tableMeta.json';

export type ColumnMeta = { name: string; header: string; type: 'TEXT' | 'DATE' | 'NUMERIC' };
export type TableMeta = { db_table: string; title: string; columns: ColumnMeta[] };
type SheetMeta = { desc: string; tables: TableMeta[] };

const META = tableMeta as Record<string, SheetMeta>;

// slug helper must match database/schema.sql generator
function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);
}

export const genericRouter = Router();

// GET /api/sheets  -> list of sheets + table metadata (for the frontend to build forms/columns)
genericRouter.get('/sheets', (_req: Request, res: Response) => {
  const out = Object.entries(META).map(([sheet, m]) => ({
    sheet,
    desc: m.desc,
    tables: m.tables.map(t => ({ title: t.title, db_table: t.db_table, columns: t.columns })),
  }));
  res.json(out);
});

export function findTable(sheet: string, tableIndex: number): TableMeta | null {
  const m = META[sheet];
  if (!m) return null;
  return m.tables[tableIndex] || null;
}

/**
 * Builds the WHERE clause shared by /api/data and /api/stats, so the KPI cards on a
 * sheet page always count exactly the rows the table below them is listing.
 */
export function buildFilter(t: TableMeta, query: Record<string, string>): { whereSql: string; params: any[] } {
  const { q, project, status } = query;
  const where: string[] = [];
  const params: any[] = [];

  if (q) {
    const textCols = t.columns.filter(c => c.type === 'TEXT').map(c => `"${c.name}"::text`);
    if (textCols.length) {
      params.push(`%${q}%`);
      where.push('(' + textCols.map(c => `${c} ILIKE $${params.length}`).join(' OR ') + ')');
    }
  }
  const projectCol = t.columns.find(c => /^project(_code)?$/.test(c.name));
  if (project && projectCol) {
    params.push(project);
    where.push(`"${projectCol.name}" = $${params.length}`);
  }
  const statusCol = t.columns.find(c => c.name === 'status' || c.name.includes('status'));
  if (status && statusCol) {
    params.push(status);
    where.push(`"${statusCol.name}" = $${params.length}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// GET /api/data/:sheet/:tableIndex?  -> list rows (filter, search, pagination)
genericRouter.get('/data/:sheet/:tableIndex(\\d+)?', async (req: Request, res: Response) => {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = req.params.tableIndex ? Number(req.params.tableIndex) : 0;
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const { page = '1', pageSize = '50' } = req.query as Record<string, string>;
  const { whereSql, params } = buildFilter(t, req.query as Record<string, string>);
  const limit = Math.min(Number(pageSize) || 50, 500);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const countRes = await pool.query(`SELECT COUNT(*) FROM "${t.db_table}" ${whereSql}`, params);
  params.push(limit, offset);
  const rowsRes = await pool.query(
    `SELECT * FROM "${t.db_table}" ${whereSql} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    total: Number(countRes.rows[0].count),
    page: Number(page) || 1,
    pageSize: limit,
    rows: rowsRes.rows,
  });
});

// POST /api/data/:sheet/:tableIndex  -> insert a row
genericRouter.post('/data/:sheet/:tableIndex(\\d+)?', async (req: Request, res: Response) => {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = req.params.tableIndex ? Number(req.params.tableIndex) : 0;
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const body = req.body || {};
  const cols = t.columns.filter(c => c.name in body);
  if (!cols.length) return res.status(400).json({ error: 'No known columns in body' });

  const colSql = cols.map(c => `"${c.name}"`).join(',');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  const values = cols.map(c => (body[c.name] === '' ? null : body[c.name]));

  const result = await pool.query(
    `INSERT INTO "${t.db_table}" (${colSql}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/data/:sheet/:tableIndex/:id -> update a row
genericRouter.put('/data/:sheet/:tableIndex(\\d+)/:id(\\d+)', async (req: Request, res: Response) => {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = Number(req.params.tableIndex);
  const id = Number(req.params.id);
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const body = req.body || {};
  const cols = t.columns.filter(c => c.name in body);
  if (!cols.length) return res.status(400).json({ error: 'No known columns in body' });

  const setSql = cols.map((c, i) => `"${c.name}" = $${i + 1}`).join(',');
  const values = cols.map(c => (body[c.name] === '' ? null : body[c.name]));
  values.push(id);

  const result = await pool.query(
    `UPDATE "${t.db_table}" SET ${setSql} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Row not found' });
  res.json(result.rows[0]);
});

// DELETE /api/data/:sheet/:tableIndex/:id
genericRouter.delete('/data/:sheet/:tableIndex(\\d+)/:id(\\d+)', async (req: Request, res: Response) => {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = Number(req.params.tableIndex);
  const id = Number(req.params.id);
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  await pool.query(`DELETE FROM "${t.db_table}" WHERE id = $1`, [id]);
  res.status(204).send();
});
