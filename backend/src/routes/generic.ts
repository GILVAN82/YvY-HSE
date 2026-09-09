import { logAccessDenial } from '../auth/access-log';
import { Router, Request, Response } from 'express';
import { authorizeTable, authorizeRecordWrite, tableScopeSql } from '../auth/table-access';
import { AuthorizationError } from '../auth/authorization';
import tableMeta from '../config/tableMeta.json';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { assertProjectAccess, hasPermission, requirePermission } from '../auth/authorization';

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

export function findTable(sheet: string, tableIndex: number): TableMeta | null {
  const m = META[sheet];
  if (!m) return null;
  return m.tables[tableIndex] || null;
}

/**
 * Builds the WHERE clause shared by /api/data and /api/stats, so the KPI cards on a
 * sheet page always count exactly the rows the table below them is listing.
 */
export function buildFilter(t:TableMeta,query:Record<string,string>,allowedProjects?:readonly string[]|null):{whereSql:string;params:any[]} {
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
  where.push(tableScopeSql(t.db_table,allowedProjects===undefined?[]:allowedProjects,params,project));
  const statusCol = t.columns.find(c => c.name === 'status' || c.name.includes('status'));
  if (status && statusCol) {
    params.push(status);
    where.push(`"${statusCol.name}" = $${params.length}`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function createGenericRouter(database: Pick<import('pg').Pool,'query'>) {
const genericRouter = Router();
genericRouter.use(requirePermission('HSE_DATA_READ'));

// GET /api/sheets  -> list of sheets + table metadata (for the frontend to build forms/columns)
genericRouter.get('/sheets', (_req: Request, res: Response) => {
  const out = Object.entries(META).map(([sheet, m]) => ({
    sheet,
    desc: m.desc,
    tables: m.tables.map(t => ({ title: t.title, db_table: t.db_table, columns: t.columns })),
  }));
  res.json(out);
});

// GET /api/data/:sheet/:tableIndex?  -> list rows (filter, search, pagination)
genericRouter.get('/data/:sheet/:tableIndex(\\d+)?', async (req: Request, res: Response, next) => {
 try {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = req.params.tableIndex ? Number(req.params.tableIndex) : 0;
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const { page = '1', pageSize = '50' } = req.query as Record<string, string>;
  const principal=(req as AuthenticatedRequest).principal;
  const requestedProject=(req.query as Record<string,string>).project;
  if(requestedProject) try{assertProjectAccess(principal,requestedProject);}catch{return res.status(403).json({error:'Access denied.',code:'PROJECT_SCOPE_DENIED'});}
  authorizeTable(principal,t.db_table,'read');
  const allowed=hasPermission(principal,'ADMIN_ACCESS')?null:principal.allowedProjectIds;
  const {whereSql,params}=buildFilter(t,req.query as Record<string,string>,allowed);
  const limit = Math.min(Number(pageSize) || 50, 500);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const countRes = await database.query(`SELECT COUNT(*) FROM "${t.db_table}" ${whereSql}`, params);
  params.push(limit, offset);
  const rowsRes = await database.query(
    `SELECT * FROM "${t.db_table}" ${whereSql} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({
    total: Number(countRes.rows[0].count),
    page: Number(page) || 1,
    pageSize: limit,
    rows: rowsRes.rows,
  });
 } catch(error) { next(error); }
});

// POST /api/data/:sheet/:tableIndex  -> insert a row
genericRouter.post('/data/:sheet/:tableIndex(\\d+)?', async (req: Request, res: Response, next) => {
 try {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = req.params.tableIndex ? Number(req.params.tableIndex) : 0;
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const principal=(req as AuthenticatedRequest).principal;
  authorizeTable(principal,t.db_table,'write');
  const body = req.body || {};
  const cols = t.columns.filter(c => c.name in body);
  if (!cols.length) return res.status(400).json({ error: 'No known columns in body' });

  await authorizeRecordWrite(database,principal,t.db_table,body);
  const colSql = cols.map(c => `"${c.name}"`).join(',');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  const values = cols.map(c => (body[c.name] === '' ? null : body[c.name]));

  const result = await database.query(
    `INSERT INTO "${t.db_table}" (${colSql}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  res.status(201).json(result.rows[0]); } catch(error) { next(error); }
});

// PUT /api/data/:sheet/:tableIndex/:id -> update a row
genericRouter.put('/data/:sheet/:tableIndex(\\d+)/:id(\\d+)', async (req: Request, res: Response, next) => {
 try {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = Number(req.params.tableIndex);
  const id = Number(req.params.id);
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const principal=(req as AuthenticatedRequest).principal;
  authorizeTable(principal,t.db_table,'write');
  const current=await database.query(`SELECT * FROM "${t.db_table}" WHERE id=$1`,[id]);
  if(!current.rows.length)throw new AuthorizationError(undefined,'RESOURCE_NOT_FOUND');
  await authorizeRecordWrite(database,principal,t.db_table,current.rows[0]);
  const body = req.body || {};
  await authorizeRecordWrite(database,principal,t.db_table,{...current.rows[0],...body});
  const cols = t.columns.filter(c => c.name in body);
  if (!cols.length) return res.status(400).json({ error: 'No known columns in body' });

  const setSql = cols.map((c, i) => `"${c.name}" = $${i + 1}`).join(',');
  const values = cols.map(c => (body[c.name] === '' ? null : body[c.name]));
  values.push(id);

  const idParam=values.length;
  const scopeSql=tableScopeSql(t.db_table,hasPermission(principal,'ADMIN_ACCESS')?null:principal.allowedProjectIds,values);
  const result = await database.query(
    `UPDATE "${t.db_table}" SET ${setSql} WHERE id = $${idParam} AND ${scopeSql} RETURNING *`,
    values
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Row not found' });
  res.json(result.rows[0]); } catch(error) { next(error); }
});

// DELETE /api/data/:sheet/:tableIndex/:id
genericRouter.delete('/data/:sheet/:tableIndex(\\d+)/:id(\\d+)', async (req: Request, res: Response, next) => {
 try {
  const sheet = decodeURIComponent(req.params.sheet);
  const ti = Number(req.params.tableIndex);
  const id = Number(req.params.id);
  const t = findTable(sheet, ti);
  if (!t) return res.status(404).json({ error: 'Unknown sheet/table' });

  const principal=(req as AuthenticatedRequest).principal;
  authorizeTable(principal,t.db_table,'write');
  const current=await database.query(`SELECT * FROM "${t.db_table}" WHERE id=$1`,[id]);
  if(!current.rows.length)throw new AuthorizationError(undefined,'RESOURCE_NOT_FOUND');
  await authorizeRecordWrite(database,principal,t.db_table,current.rows[0]);
  const params:unknown[]=[id];const scopeSql=tableScopeSql(t.db_table,hasPermission(principal,'ADMIN_ACCESS')?null:principal.allowedProjectIds,params);
  await database.query(`DELETE FROM "${t.db_table}" WHERE id = $1 AND ${scopeSql}`, params);
  res.status(204).send(); } catch(error) { next(error); }
});

 genericRouter.use((error:unknown,_req:Request,res:Response,_next:import('express').NextFunction)=>{
   if(error instanceof AuthorizationError){logAccessDenial(error.code,'operational_table',_req.method,( _req as AuthenticatedRequest).principal.role);res.status(error.code==='RESOURCE_NOT_FOUND'?404:403).json({code:error.code,error:'The requested resource is not available.'});return;}
   res.status(503).json({code:'DATA_QUERY_FAILED',error:'Operational data is temporarily unavailable.'});
 });
 return genericRouter;
}
