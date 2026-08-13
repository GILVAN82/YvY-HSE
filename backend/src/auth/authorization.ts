import type { NextFunction, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest, RequestPrincipal } from './auth.types';

export const ROLES = ['ADMIN','HSE_MANAGER','HSE_USER','APPROVER'] as const;
export type AppRole = typeof ROLES[number];
export const PERMISSIONS = ['HSE_DATA_READ','PROJECT_READ','AI_USE','MEMORY_USE','HITL_APPROVE','ADMIN_ACCESS'] as const;
export type Permission = typeof PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  HSE_MANAGER: ['HSE_DATA_READ','PROJECT_READ','AI_USE','MEMORY_USE','HITL_APPROVE'],
  HSE_USER: ['HSE_DATA_READ','PROJECT_READ','AI_USE','MEMORY_USE'],
  APPROVER: ['HSE_DATA_READ','PROJECT_READ','AI_USE','MEMORY_USE','HITL_APPROVE'],
};

export const permissionsForRole = (role: AppRole): Permission[] => [...ROLE_PERMISSIONS[role]];
export const hasPermission = (principal: RequestPrincipal, permission: Permission) => principal.permissions.includes(permission);
export const canAccessProject = (principal: RequestPrincipal, projectCode: string) => hasPermission(principal,'ADMIN_ACCESS') || principal.allowedProjectIds.includes(projectCode);

export class AuthorizationError extends Error { readonly code='AUTH_FORBIDDEN'; }
export function assertProjectAccess(principal: RequestPrincipal, projectCode: string) {
  if (!canAccessProject(principal, projectCode)) throw new AuthorizationError('The requested resource is not available.');
}
export const requirePermission = (permission: Permission): RequestHandler => (req, res, next) => {
  if (hasPermission((req as AuthenticatedRequest).principal, permission)) return next();
  res.status(403).json({ error:'Access denied.', code:'AUTH_FORBIDDEN' });
};
