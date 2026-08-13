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
import { pool } from './db/pool';
import { PostgresAuthRepository } from './auth/auth.repository';
import { AuthService } from './auth/auth.service';
import { createAuthRouter } from './routes/auth';
import { requireAuthentication, requireTrustedOrigin } from './auth/auth.middleware';

// Fail fast on a bad AI_ORCHESTRATOR rather than surprising the first caller.
const orchestrator = readOrchestrator();
const corsOrigins = readCorsOrigins();
const writesEnabled = readWritesEnabled();
temporaryAttachmentService.initialize().catch(() => console.warn(JSON.stringify({ event: 'attachment_startup_cleanup', status: 'UNAVAILABLE' })));

const app = express();
const authService = new AuthService(new PostgresAuthRepository(pool));

// Allowlist instead of a wildcard. CORS is not authentication — it only stops another
// origin's page from using the API from a browser. See docs/limitations.md.
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Same-origin and non-browser callers (curl, tests) send no Origin header.
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Origin is not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: MAX_BODY_SIZE }));
app.use('/api', requireTrustedOrigin(corsOrigins));

app.get('/api/health', (_req, res) => res.json({ ok: true, orchestrator }));
app.use('/api', createAuthRouter(authService));
app.use('/api', requireAuthentication(authService));

/**
 * Defense-in-depth write guard retained until Sprint 3.3 adds RBAC.
 *
 * Authentication is enforced above. Existing HSE record writes remain closed unless
 * explicitly enabled; auth/session and AI workflow POSTs are handled separately.
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
