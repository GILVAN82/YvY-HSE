import { logAccessDenial } from './access-log';
import type { NextFunction, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest, RequestPrincipal } from './auth.types';

export const ROLES = ['ADMIN','HSE_MANAGER','HSE_USER','APPROVER'] as const;
export type AppRole = typeof ROLES[number];
export const PERMISSIONS = ['HSE_DATA_READ','HSE_DATA_WRITE','PROJECT_READ','AI_USE','MEMORY_USE','HITL_APPROVE','ADMIN_ACCESS'] as const;
export type Permission = typeof PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  HSE_MANAGER: ['HSE_DATA_READ','HSE_DATA_WRITE','PROJECT_READ','AI_USE','MEMORY_USE','HITL_APPROVE'],
  HSE_USER: ['HSE_DATA_READ','PROJECT_READ','AI_USE','MEMORY_USE'],
  APPROVER: ['HSE_DATA_READ','PROJECT_READ','AI_USE','MEMORY_USE','HITL_APPROVE'],
};

export const permissionsForRole = (role: AppRole): Permission[] => [...ROLE_PERMISSIONS[role]];
export const hasPermission = (principal: RequestPrincipal, permission: Permission) => principal.permissions.includes(permission);
export const canAccessProject = (principal: RequestPrincipal, projectCode: string) => hasPermission(principal,'ADMIN_ACCESS') || principal.allowedProjectIds.includes(projectCode);

export type AccessErrorCode = 'AUTHORIZATION_DENIED' | 'PROJECT_SCOPE_DENIED' | 'RESOURCE_OWNERSHIP_DENIED' | 'RESOURCE_NOT_FOUND';
export class AuthorizationError extends Error {
  constructor(message = 'The requested resource is not available.', readonly code: AccessErrorCode = 'AUTHORIZATION_DENIED') { super(message); }
}
export function logAuthorizationDenial(principal: RequestPrincipal, code: AccessErrorCode, resourceType: string, operation: string, context: {runId?:string;threadId?:string} = {}) {
  logAccessDenial(code,resourceType,operation,principal.role,context);
}
export function denyAccess(principal:RequestPrincipal, code:AccessErrorCode, resourceType:string, operation:string): never {
  logAuthorizationDenial(principal,code,resourceType,operation);throw new AuthorizationError(undefined,code);
}
export function assertPermission(principal:RequestPrincipal,permission:Permission,resourceType='operational_data',operation='read') {
  if(!hasPermission(principal,permission))denyAccess(principal,'AUTHORIZATION_DENIED',resourceType,operation);
}
export function assertProjectAccess(principal: RequestPrincipal, projectCode: string) {
  if (!canAccessProject(principal, projectCode)) denyAccess(principal,'PROJECT_SCOPE_DENIED','project','access');
}
export const requirePermission = (permission: Permission): RequestHandler => (req, res, next) => {
  if (hasPermission((req as AuthenticatedRequest).principal, permission)) return next();
  logAuthorizationDenial((req as AuthenticatedRequest).principal,'AUTHORIZATION_DENIED','api',req.method);
  res.status(403).json({ error:'Access denied.', code:'AUTHORIZATION_DENIED' });
};
