import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from './auth.types';
import { AuthService, SESSION_COOKIE } from './auth.service';

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) { try { return decodeURIComponent(value.join('=')); } catch { return undefined; } }
  }
  return undefined;
}

export const requireAuthentication = (service: AuthService): RequestHandler => async (req, res, next) => {
  try {
    const principal = await service.authenticate(readCookie(req, SESSION_COOKIE));
    if (!principal) { res.status(401).json({ error: 'Authentication required.', code: 'AUTHENTICATION_REQUIRED' }); return; }
    (req as AuthenticatedRequest).principal = principal;
    next();
  } catch {
    res.status(503).json({ error: 'Authentication is temporarily unavailable.', code: 'AUTH_UNAVAILABLE' });
  }
};

export function requireTrustedOrigin(allowedOrigins: readonly string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    // Browsers attach Origin to cross-origin mutations. Non-browser/same-origin
    // callers may omit it and do not create an ambient cross-site cookie request.
    if (!origin || allowedOrigins.includes(origin)) return next();
    res.status(403).json({ error: 'Request origin is not allowed.', code: 'CSRF_ORIGIN_REJECTED' });
  };
}
