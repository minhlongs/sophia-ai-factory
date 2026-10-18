/**
 * Workspace Role & Access Guard Helpers
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

export function logWorkspaceAccessDenied(
  workspaceId: string,
  userId: string,
  reason: string,
  extra?: Record<string, unknown>,
): void {
  logger.warn('[security] workspace_access_denied', {
    workspaceId: workspaceId || '',
    userId: userId || '',
    ...extra,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Throws WorkspaceAccessDeniedError if user does not have membership in workspace.
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string,
  db?: D1Client | D1Database,
): Promise<{ role: WorkspaceRole }> {
  if (!workspaceId || !userId) {
    logWorkspaceAccessDenied(workspaceId, userId, 'missing_parameters');
    throw new WorkspaceAccessDeniedError(
      'Workspace access denied: missing workspaceId or userId',
      workspaceId || '',
      userId || '',
    );
  }

  const membership = await getWorkspaceMembership(workspaceId, userId, db);
  if (!membership) {
    logWorkspaceAccessDenied(workspaceId, userId, 'not_a_member');
    throw new WorkspaceAccessDeniedError(
      `Workspace access denied for user ${userId} in workspace ${workspaceId}`,
      workspaceId,
      userId,
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
  db?: D1Client | D1Database,
): Promise<{ role: WorkspaceRole }> {
  const membership = await requireWorkspaceAccess(workspaceId, userId, db);
  if (!hasMinimumRole(membership.role, requiredRole)) {
    logWorkspaceAccessDenied(workspaceId, userId, 'insufficient_role', {
      requiredRole,
      actualRole: membership.role,
    });
    throw new InsufficientWorkspaceRoleError(
      `User ${userId} has role ${membership.role}, but role ${requiredRole} is required for workspace ${workspaceId}`,
      workspaceId,
      requiredRole,
      membership.role,
      userId,
    );
  }

  return membership;
}
