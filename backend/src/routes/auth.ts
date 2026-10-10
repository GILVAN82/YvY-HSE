import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AuthService, SESSION_COOKIE, SESSION_TTL_MS } from '../auth/auth.service';
import { readCookie, requireAuthentication } from '../auth/auth.middleware';

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(200) });
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_TTL_MS };

export function createAuthRouter(service: AuthService) {
  const router = Router();
  router.post('/auth/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid login request.', code: 'AUTH_INVALID_REQUEST' }); return; }
    try {
      const session = await service.login(parsed.data.email, parsed.data.password);
      if (!session) { res.status(401).json({ error: 'Invalid email or password.', code: 'AUTH_INVALID_CREDENTIALS' }); return; }
      res.cookie(SESSION_COOKIE, session.token, cookieOptions).json({ user: session.user });
    } catch { res.status(500).json({ error: 'Authentication is temporarily unavailable.', code: 'AUTH_UNAVAILABLE' }); }
  });
  router.get('/auth/me', requireAuthentication(service), (req, res) => res.json({ user: (req as AuthenticatedRequest).principal }));
  router.post('/auth/logout', requireAuthentication(service), async (req, res) => {
    await service.logout(readCookie(req, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined }).status(204).end();
  });
  return router;
}
