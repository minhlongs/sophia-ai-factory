/**
 * Workspace Access Verifier Primitives
 *
 * Layer: seed/auth
 */

import type { D1Client, D1Database } from '@/seed/db/client';
import { hasMinimumRole, type WorkspaceRole } from './roles';
import { getWorkspaceMembership } from './tenant-resolver';
import {
  logWorkspaceAccessDenied,
  requireWorkspaceAccess,
  requireWorkspaceRole,
} from './workspace-role-guards';

export { requireWorkspaceAccess, requireWorkspaceRole };

/**
 * Checks whether a user has access to a workspace (any membership role).
 * Fail-closed with structured security event telemetry.
 */
export async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
  db?: D1Client | D1Database,
): Promise<boolean> {
  if (!workspaceId || !userId) {
    logWorkspaceAccessDenied(workspaceId, userId, 'missing_parameters');
    return false;
  }

  const membership = await getWorkspaceMembership(workspaceId, userId, db);
  if (!membership) {
    logWorkspaceAccessDenied(workspaceId, userId, 'not_a_member');
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
  db?: D1Client | D1Database,
): Promise<boolean> {
  if (!workspaceId || !userId) {
    logWorkspaceAccessDenied(workspaceId, userId, 'missing_parameters', {
      requiredRole,
    });
    return false;
  }

  const membership = await getWorkspaceMembership(workspaceId, userId, db);
  if (!membership) {
    logWorkspaceAccessDenied(workspaceId, userId, 'not_a_member', {
      requiredRole,
    });
    return false;
  }

  if (!hasMinimumRole(membership.role, requiredRole)) {
    logWorkspaceAccessDenied(workspaceId, userId, 'insufficient_role', {
      requiredRole,
      actualRole: membership.role,
    });
    return false;
  }

  return true;
}

/**
 * Alias for verifyWorkspaceRole for semantic role verification.
 */
export const hasWorkspaceRole = verifyWorkspaceRole;
