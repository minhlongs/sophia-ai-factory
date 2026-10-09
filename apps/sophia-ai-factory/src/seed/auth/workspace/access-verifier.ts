/**
 * Workspace Access Verifier Primitives
 *
 * Layer: seed/auth
 */

import type { D1Client, D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  hasMinimumRole,
  InsufficientWorkspaceRoleError,
  WorkspaceAccessDeniedError,
  type WorkspaceRole,
} from './roles';
import { getWorkspaceMembership } from './tenant-resolver';

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
