/**
 * Server Actions for rollback operations.
 * Wraps tree-layer rollback functions with auth and workspace permission checks.
 * All functions return Result<T, E> — no thrown exceptions across action boundaries.
 *
 * @module land/rollback/actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  logRollback,
  getRollbackHistory,
  type RollbackRecord,
  type RollbackRepoError,
} from '@/tree/rollback';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type RollbackActionError =
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'NOT_AUTHENTICATED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string }
  | { code: 'INTERNAL'; message: string };

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RollbackMissionSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  const d1 = getD1();
  if (!d1) return Promise.resolve(null);
  return d1
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<{ org_id: string }>()
    .then((row) => row?.org_id ?? null)
    .catch(() => null);
}

async function assertWorkspaceAdmin(
  userId: string,
  workspaceId: string,
): Promise<Result<void, RollbackActionError>> {
  try {
    const d1 = getD1();
    if (!d1) return failure({ code: 'DB_ERROR', message: 'Database not available' });

    const membership = await d1
      .prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .first<{ role: string }>();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const allowedRoles = ['owner', 'admin'];
    if (!allowedRoles.includes(membership.role)) {
      return failure({ code: 'FORBIDDEN', message: 'Only workspace owners or admins can trigger rollback' });
    }

    return success(undefined);
  } catch (err) {
    const message = toError(err).message;
    logger.error('[RollbackAction] workspace admin check failed', { error: message, userId, workspaceId });
    return failure({ code: 'DB_ERROR', message });
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Trigger a rollback for a mission.
 * Requires authenticated user with workspace owner or admin role.
 */
export async function rollbackMissionAction(
  missionId: string,
  reason: string,
): Promise<Result<{ success: boolean }, RollbackActionError>> {
  try {
    const parsed = RollbackMissionSchema.safeParse({ missionId, reason });
    if (!parsed.success) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((e) => e.message).join(', '),
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const workspaceId = await getWorkspaceIdForUser(user.id);
    if (!workspaceId) {
      return failure({ code: 'NOT_FOUND', message: 'No workspace found for this user' });
    }

    const permResult = await assertWorkspaceAdmin(user.id, workspaceId);
    if (!permResult.ok) return permResult;

    // Fetch current mission to get its status
    const mission = await d1
      .prepare('SELECT id, status FROM missions WHERE id = ?1 AND workspace_id = ?2')
      .bind(missionId, workspaceId)
      .first<{ id: string; status: string }>();

    if (!mission) {
      return failure({ code: 'NOT_FOUND', message: 'Mission not found' });
    }

    const logResult = await logRollback({
      workspaceId,
      missionId,
      reason,
      fromStatus: mission.status,
      toStatus: 'rolled_back',
      triggeredBy: user.id,
    });

    if (!logResult.ok) {
      return failure({
        code: 'REPO_ERROR',
        message: logResult.error.message,
        details: logResult.error.code,
      });
    }

    logger.info('[RollbackAction] rollbackMissionAction success', {
      userId: user.id,
      workspaceId,
      missionId,
    });
    return success({ success: true });
  } catch (err) {
    const error = toError(err);
    logger.error('[RollbackAction] rollbackMissionAction failed', { error: error.message });
    return failure({ code: 'INTERNAL', message: error.message } as RollbackActionError);
  }
}

/**
 * Fetch rollback history for a mission.
 * Requires authenticated user with workspace access.
 */
export async function getRollbackHistoryAction(
  missionId: string,
): Promise<Result<RollbackRecord[], RollbackActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const workspaceId = await getWorkspaceIdForUser(user.id);
    if (!workspaceId) {
      return failure({ code: 'NOT_FOUND', message: 'No workspace found for this user' });
    }

    // Verify user has membership (read-only check)
    const membership = await d1
      .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(workspaceId, user.id)
      .first();

    if (!membership) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }

    const result = await getRollbackHistory(missionId);
    if (!result.ok) {
      return failure({
        code: 'REPO_ERROR',
        message: result.error.message,
        details: result.error.code,
      });
    }

    // Filter to only records belonging to this workspace
    const filtered = result.value.filter((r) => r.workspaceId === workspaceId);
    return success(filtered);
  } catch (err) {
    const error = toError(err);
    logger.error('[RollbackAction] getRollbackHistoryAction failed', { error: error.message });
    return failure({ code: 'INTERNAL', message: error.message } as RollbackActionError);
  }
}
