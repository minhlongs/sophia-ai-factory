/**
 * Workspace Roles, Hierarchy & Access Errors
 *
 * Layer: seed/auth
 */

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'MEMBER' | 'VIEWER';

export const WORKSPACE_ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  OPERATOR: 30,
  MEMBER: 20,
  VIEWER: 10,
} as const;

export const ROLE_HIERARCHY = WORKSPACE_ROLE_HIERARCHY;

/**
 * Normalizes input role string to canonical WorkspaceRole (case-insensitive, trimmed).
 * Defaults to fallback ('MEMBER' by default for backward compatibility, or 'VIEWER' for least-privilege)
 * if undefined, empty, or unparseable.
 */
export function normalizeWorkspaceRole(
  role: string | null | undefined,
  fallback: WorkspaceRole = 'MEMBER'
): WorkspaceRole {
  if (!role || typeof role !== 'string') {
    return fallback;
  }
  const upper = role.trim().toUpperCase();
  switch (upper) {
    case 'OWNER':
      return 'OWNER';
    case 'ADMIN':
      return 'ADMIN';
    case 'OPERATOR':
      return 'OPERATOR';
    case 'MEMBER':
      return 'MEMBER';
    case 'VIEWER':
      return 'VIEWER';
    default:
      return fallback;
  }
}

/**
 * Checks if userRole satisfies the minimum requiredRole according to WORKSPACE_ROLE_HIERARCHY.
 * Enforces least-privilege 'VIEWER' normalization for untrusted userRole inputs.
 */
export function hasMinimumRole(
  userRole: WorkspaceRole | string | null | undefined,
  requiredRole: WorkspaceRole | string | null | undefined
): boolean {
  const normalizedUser = normalizeWorkspaceRole(userRole, 'VIEWER');
  const normalizedReq = normalizeWorkspaceRole(requiredRole, 'MEMBER');
  return WORKSPACE_ROLE_HIERARCHY[normalizedUser] >= WORKSPACE_ROLE_HIERARCHY[normalizedReq];
}

// ---------------------------------------------------------------------------
// Typed Security Error Classes (Fail-Closed)
// ---------------------------------------------------------------------------

export class WorkspaceAccessError extends Error {
  readonly status: number;
  readonly code: string;
  readonly workspaceId: string;
  readonly userId?: string;

  constructor(
    message: string,
    workspaceId: string,
    userId?: string,
    code: string = 'WORKSPACE_ACCESS_DENIED',
    status: number = 403
  ) {
    super(message);
    this.name = 'WorkspaceAccessError';
    this.status = status;
    this.code = code;
    this.workspaceId = workspaceId;
    this.userId = userId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WorkspaceAccessDeniedError extends WorkspaceAccessError {
  constructor(message: string = 'Workspace access denied', workspaceId: string, userId?: string) {
    super(message, workspaceId, userId, 'WORKSPACE_ACCESS_DENIED', 403);
    this.name = 'WorkspaceAccessDeniedError';
  }
}

export class WorkspaceNotFoundError extends WorkspaceAccessError {
  constructor(message: string = 'Workspace not found', workspaceId: string) {
    super(message, workspaceId, undefined, 'WORKSPACE_NOT_FOUND', 404);
    this.name = 'WorkspaceNotFoundError';
  }
}

export class InsufficientWorkspaceRoleError extends WorkspaceAccessError {
  readonly requiredRole: WorkspaceRole;
  readonly actualRole: WorkspaceRole;

  constructor(
    message: string,
    workspaceId: string,
    requiredRole: WorkspaceRole,
    actualRole: WorkspaceRole,
    userId?: string
  ) {
    super(message, workspaceId, userId, 'INSUFFICIENT_WORKSPACE_ROLE', 403);
    this.name = 'InsufficientWorkspaceRoleError';
    this.requiredRole = requiredRole;
    this.actualRole = actualRole;
  }
}

// ---------------------------------------------------------------------------
// Tenant Scope Context Interfaces
// ---------------------------------------------------------------------------

import type { D1Client, D1Database } from '@/seed/db/client';

export interface TenantScopeContext {
  readonly workspaceId: string;
  readonly userId?: string;
  readonly role: WorkspaceRole;
  readonly db: D1Client;
}

export interface TenantScopeOptions {
  workspaceId: string;
  userId?: string;
  requiredRole?: WorkspaceRole;
  db?: D1Client | D1Database;
}
