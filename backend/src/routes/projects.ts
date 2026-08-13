import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { hasPermission, requirePermission } from '../auth/authorization';

export const projectsRouter = Router();
projectsRouter.use(requirePermission('PROJECT_READ'));

projectsRouter.get('/projects', async (req: Request, res: Response) => {
  const p=(req as AuthenticatedRequest).principal;
  const r=hasPermission(p,'ADMIN_ACCESS')?await pool.query('SELECT * FROM projects ORDER BY code'):await pool.query('SELECT * FROM projects WHERE code=ANY($1::text[]) ORDER BY code',[p.allowedProjectIds]);
  res.json(r.rows);
});

projectsRouter.post('/projects', async (req: Request, res: Response) => {
  const b = req.body || {};
  const r = await pool.query(
    `INSERT INTO projects (code,name,client,location,country_region,project_manager,hse_manager,project_type,status,start_date,planned_end_date,actual_end_date,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [b.code, b.name, b.client||null, b.location||null, b.country_region||null, b.project_manager||null,
     b.hse_manager||null, b.project_type||null, b.status||'Active', b.start_date||null,
     b.planned_end_date||null, b.actual_end_date||null, b.notes||null]
  );
  res.status(201).json(r.rows[0]);
});

projectsRouter.put('/projects/:code', async (req: Request, res: Response) => {
  const b = req.body || {};
  const r = await pool.query(
    `UPDATE projects SET name=$2,client=$3,location=$4,country_region=$5,project_manager=$6,
     hse_manager=$7,project_type=$8,status=$9,start_date=$10,planned_end_date=$11,actual_end_date=$12,notes=$13
     WHERE code=$1 RETURNING *`,
    [req.params.code, b.name, b.client||null, b.location||null, b.country_region||null, b.project_manager||null,
     b.hse_manager||null, b.project_type||null, b.status, b.start_date||null, b.planned_end_date||null,
     b.actual_end_date||null, b.notes||null]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Project not found' });
  res.json(r.rows[0]);
});

export const listsRouter = Router();
listsRouter.use(requirePermission('HSE_DATA_READ'));

listsRouter.get('/lists', async (_req: Request, res: Response) => {
  const r = await pool.query('SELECT "group", title, item FROM lookup_lists ORDER BY "group", title, id');
  const grouped: Record<string, Record<string, string[]>> = {};
  for (const row of r.rows) {
    grouped[row.group] = grouped[row.group] || {};
    (grouped[row.group][row.title] = grouped[row.group][row.title] || []).push(row.item);
  }
  res.json(grouped);
});

listsRouter.get('/settings', async (_req: Request, res: Response) => {
  const r = await pool.query('SELECT named_range, value, used_for FROM settings ORDER BY named_range');
  res.json(r.rows);
});
