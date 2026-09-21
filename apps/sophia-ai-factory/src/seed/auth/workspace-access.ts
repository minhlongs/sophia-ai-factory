/**
 * Canonical Workspace Access & Tenant Scope Primitive
 * Single source of truth for multi-tenant isolation, role evaluation,
 * fail-closed access verification, and security telemetry.
 *
 * Layer: seed/auth (Foundational primitive)
 */

import * as dbClientModule from '@/seed/db/client';
import type { D1Client, D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

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
// DB Client Resolution Helper
// ---------------------------------------------------------------------------

function resolveClient(db?: D1Client | D1Database | { prepare: unknown }): D1Client {
  if (db) {
    return db as unknown as D1Client;
  }
  if (typeof dbClientModule.createServerClient === 'function') {
    return dbClientModule.createServerClient();
  }
  return {} as D1Client;
}

// ---------------------------------------------------------------------------
// Core Verification Primitives
// ---------------------------------------------------------------------------

/**
 * Retrieves the user's membership role for the given workspace.
 * Returns { role } if member, or null if not found/error occurs.
 */
export async function getWorkspaceMembership(
  workspaceId: string,
  userId: string,
  db?: D1Client | D1Database
): Promise<{ role: WorkspaceRole } | null> {
  if (!workspaceId || !userId) {
    return null;
  }
  try {
    const client = resolveClient(db);
    const row = await client
      .prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ? LIMIT 1')
      .bind(workspaceId, userId)
      .first<{ role?: string } | Record<string, unknown>>();

    if (!row) {
      return null;
    }

    let roleString: string | undefined;
    if (typeof row === 'object' && row !== null) {
      if ('role' in row && typeof (row as { role?: unknown }).role === 'string') {
        roleString = (row as { role: string }).role;
      }
    }

    return {
      role: normalizeWorkspaceRole(roleString),
    };
  } catch (error) {
    logger.warn('[security] workspace_membership_lookup_error', {
      workspaceId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * Checks whether a user has access to a workspace (any membership role).
 * Fail-closed with structured security event telemetry.
 */
export async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
  db?: D1Client | D1Database
): Promise<boolean> {
  if (!workspaceId || !userId) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId: workspaceId || '',
      userId: userId || '',
      reason: 'missing_parameters',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  const membership = await getWorkspaceMembership(workspaceId, userId, db);
  if (!membership) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId,
      userId,
      reason: 'not_a_member',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  return true;
}

/**
 * Checks whether a user has at least the required role in a workspace.
 */
export async function verifyWorkspaceRole(
  workspaceId: string,
  userId: string,
  requiredRole: WorkspaceRole,
  db?: D1Client | D1Database
): Promise<boolean> {
  if (!workspaceId || !userId) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId: workspaceId || '',
      userId: userId || '',
      requiredRole,
      reason: 'missing_parameters',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  const membership = await getWorkspaceMembership(workspaceId, userId, db);
  if (!membership) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId,
      userId,
      requiredRole,
      reason: 'not_a_member',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  if (!hasMinimumRole(membership.role, requiredRole)) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId,
      userId,
      requiredRole,
      actualRole: membership.role,
      reason: 'insufficient_role',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  return true;
}

/**
 * Alias for verifyWorkspaceRole for semantic role verification.
 */
export const hasWorkspaceRole = verifyWorkspaceRole;

/**
 * Throws WorkspaceAccessDeniedError if user does not have membership in workspace.
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string,
  db?: D1Client | D1Database
): Promise<{ role: WorkspaceRole }> {
  if (!workspaceId || !userId) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId: workspaceId || '',
      userId: userId || '',
      reason: 'missing_parameters',
      timestamp: new Date().toISOString(),
    });
    throw new WorkspaceAccessDeniedError(
      'Workspace access denied: missing workspaceId or userId',
      workspaceId || '',
      userId || ''
    );
  }

  const membership = await getWorkspaceMembership(workspaceId, userId, db);
  if (!membership) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId,
      userId,
      reason: 'not_a_member',
      timestamp: new Date().toISOString(),
    });
    throw new WorkspaceAccessDeniedError(
      `Workspace access denied for user ${userId} in workspace ${workspaceId}`,
      workspaceId,
      userId
    );
  }

  return membership;
}

/**
 * Throws InsufficientWorkspaceRoleError if user role is below requiredRole.
 */
export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  requiredRole: WorkspaceRole,
  db?: D1Client | D1Database
): Promise<{ role: WorkspaceRole }> {
  const membership = await requireWorkspaceAccess(workspaceId, userId, db);
  if (!hasMinimumRole(membership.role, requiredRole)) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId,
      userId,
      requiredRole,
      actualRole: membership.role,
      reason: 'insufficient_role',
      timestamp: new Date().toISOString(),
    });
    throw new InsufficientWorkspaceRoleError(
      `User ${userId} has role ${membership.role}, but role ${requiredRole} is required for workspace ${workspaceId}`,
      workspaceId,
      requiredRole,
      membership.role,
      userId
    );
  }

  return membership;
}

// ---------------------------------------------------------------------------
// Tenant Scope Execution Primitive
// ---------------------------------------------------------------------------

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

/**
 * Executes a scoped callback within a verified workspace tenant boundary.
 * Supports interactive user sessions as well as background workers (Inngest / cron).
 */
export async function withTenantScope<T>(
  options: TenantScopeOptions,
  fn: (scope: TenantScopeContext) => Promise<T>
): Promise<T> {
  const { workspaceId, userId, requiredRole, db } = options;

  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    logger.warn('[security] workspace_access_denied', {
      workspaceId: workspaceId || '',
      userId,
      reason: 'invalid_workspace_id',
      timestamp: new Date().toISOString(),
    });
    throw new WorkspaceAccessError(
      'Invalid or missing workspaceId',
      workspaceId || '',
      userId
    );
  }

  const client = resolveClient(db);

  if (userId) {
    const membership = requiredRole
      ? await requireWorkspaceRole(workspaceId, userId, requiredRole, client)
      : await requireWorkspaceAccess(workspaceId, userId, client);

    const scope: TenantScopeContext = {
      workspaceId,
      userId,
      role: membership.role,
      db: client,
    };
    return await fn(scope);
  }

  // Background worker context (no userId provided):
  // Verify workspace exists in organizations table (or org_members fallback)
  let exists = false;
  try {
    const orgRow = await client
      .prepare('SELECT 1 FROM organizations WHERE id = ? LIMIT 1')
      .bind(workspaceId)
      .first();
    if (orgRow !== null && orgRow !== undefined) {
      exists = true;
    }
  } catch {
    // organizations table query failed or not present in test mock, fallback to org_members
  }

  if (!exists) {
    try {
      const memberRow = await client
        .prepare('SELECT 1 FROM org_members WHERE org_id = ? LIMIT 1')
        .bind(workspaceId)
        .first();
      if (memberRow !== null && memberRow !== undefined) {
        exists = true;
      }
    } catch {
      // ignore fallback error
    }
  }

  if (!exists) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId,
      reason: 'workspace_not_found',
      timestamp: new Date().toISOString(),
    });
    throw new WorkspaceNotFoundError(`Workspace ${workspaceId} not found`, workspaceId);
  }

  const backgroundRole: WorkspaceRole = 'OPERATOR';
  if (requiredRole && !hasMinimumRole(backgroundRole, requiredRole)) {
    logger.warn('[security] workspace_access_denied', {
      workspaceId,
      requiredRole,
      actualRole: backgroundRole,
      reason: 'insufficient_role',
      timestamp: new Date().toISOString(),
    });
    throw new InsufficientWorkspaceRoleError(
      `Background context has role ${backgroundRole}, but role ${requiredRole} is required for workspace ${workspaceId}`,
      workspaceId,
      requiredRole,
      backgroundRole
    );
  }

  const scope: TenantScopeContext = {
    workspaceId,
    role: backgroundRole,
    db: client,
  };

  return await fn(scope);
}

/**
 * Resolves all workspace IDs accessible to a user.
 * Returns array of workspace/organization IDs, ordered by creation date ascending.
 * Falls back to owned organizations if no explicit org_members rows exist.
 */
export async function getUserWorkspaceIds(
  userId: string | null | undefined,
  db?: D1Client | D1Database | null
): Promise<string[]> {
  if (!userId) return [];
  try {
    const client = resolveClient(db ?? undefined);
    if (typeof client.prepare === 'function') {
      const res = await client
        .prepare('SELECT org_id FROM org_members WHERE user_id = ? ORDER BY created_at ASC')
        .bind(userId)
        .all<{ org_id: string }>();
      const ids = (res?.results ?? []).map((r) => r.org_id).filter(Boolean);
      if (ids.length > 0) return ids;
    } else if (typeof (client as unknown as { from?: unknown }).from === 'function') {
      const res = await (client as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => Promise<{ data?: Array<{ org_id?: string }> }> } } })
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId);
      const rows = res?.data ?? [];
      const ids = (Array.isArray(rows) ? rows : [rows]).map((r) => r?.org_id).filter((id): id is string => Boolean(id));
      if (ids.length > 0) return ids;
    }

    if (typeof client.prepare === 'function') {
      const orgRes = await client
        .prepare('SELECT id FROM organizations WHERE user_id = ?')
        .bind(userId)
        .all<{ id: string }>();
      const orgIds = (orgRes?.results ?? []).map((r) => r.id).filter(Boolean);
      if (orgIds.length > 0) return orgIds;
    }
    return [];
  } catch (err) {
    logger.warn('[security] get_user_workspaces_error', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export { resolveOrgId, resolveOrgOwnerUserId } from '@/seed/auth/resolve-org-id';

