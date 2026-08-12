import './config/env.bootstrap';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { genericRouter } from './routes/generic';
import { projectsRouter, listsRouter } from './routes/projects';
import { kpiRouter } from './routes/kpi';
import { statsRouter } from './routes/sheetStats';
import { createAiChatRouter } from './routes/aiChat';
import { createProductionAiDependencies } from './ai/productionDependencies';
import { readOrchestrator, readCorsOrigins, readWritesEnabled, MAX_BODY_SIZE } from './ai/config';
import { temporaryAttachmentService } from './ai/attachments/attachment.service';

// Fail fast on a bad AI_ORCHESTRATOR rather than surprising the first caller.
const orchestrator = readOrchestrator();
const corsOrigins = readCorsOrigins();
const writesEnabled = readWritesEnabled();
temporaryAttachmentService.initialize().catch(() => console.warn(JSON.stringify({ event: 'attachment_startup_cleanup', status: 'UNAVAILABLE' })));

const app = express();

// Allowlist instead of a wildcard. CORS is not authentication — it only stops another
// origin's page from using the API from a browser. See docs/limitations.md.
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin and non-browser callers (curl, tests) send no Origin header.
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Origin is not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: MAX_BODY_SIZE }));

/**
 * Temporary write guard.
 *
 * There is no authentication yet, so POST/PUT/DELETE would let any caller on the
 * network modify HSE records. They stay closed unless ALLOW_UNAUTHENTICATED_WRITES=true
 * is set for local development. This is a stop-gap: it is replaced by real
 * authentication and RBAC in a later phase, not a permission model.
 */
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const isWrite = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
  const isChat = req.path.startsWith('/ai/');
  if (!isWrite || isChat || writesEnabled) return next();
  res.status(403).json({
    error:
      'Writes are disabled because this server does not have authentication yet. Set ALLOW_UNAUTHENTICATED_WRITES=true for local development only.',
    code: 'WRITES_DISABLED',
  });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, orchestrator }));

app.use('/api', genericRouter);
app.use('/api', projectsRouter);
app.use('/api', listsRouter);
app.use('/api', kpiRouter);
app.use('/api', statsRouter);
app.use('/api', createAiChatRouter(createProductionAiDependencies()));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`HSE API listening on http://localhost:${port}`);
  console.log(`  orchestrator: ${orchestrator}`);
  console.log(`  cors origins: ${corsOrigins.join(', ')}`);
  console.log(`  writes: ${writesEnabled ? 'ENABLED (dev)' : 'disabled (no auth yet)'}`);
});
