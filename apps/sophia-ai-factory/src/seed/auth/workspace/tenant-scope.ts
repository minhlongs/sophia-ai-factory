/**
 * Tenant Scope Execution Primitive
 *
 * Layer: seed/auth
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  hasMinimumRole,
  InsufficientWorkspaceRoleError,
  type TenantScopeContext,
  type TenantScopeOptions,
  WorkspaceAccessError,
  WorkspaceNotFoundError,
  type WorkspaceRole,
} from './roles';
import { resolveClient } from './tenant-resolver';
import { requireWorkspaceAccess, requireWorkspaceRole } from './access-verifier';

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
    throw new WorkspaceAccessError('Invalid or missing workspaceId', workspaceId || '', userId);
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
    // organizations table query failed or not present, fallback
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
