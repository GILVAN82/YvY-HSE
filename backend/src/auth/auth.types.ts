import type { Request } from 'express';
import type { AppRole, Permission } from './authorization';

export interface RequestPrincipal {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  permissions: Permission[];
  allowedProjectIds: string[];
}

export interface AuthenticatedRequest extends Request {
  principal: RequestPrincipal;
}

export interface AuthUser extends RequestPrincipal {
  passwordHash: string;
  active: boolean;
}

export interface SessionRecord {
  user: RequestPrincipal;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
}
