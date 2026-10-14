import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { logRollback } from '@/tree/rollback';
import { RollbackActionError, RollbackMissionSchema } from './types';
import { assertWorkspaceAdmin, getWorkspaceIdForUser } from './helpers';

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

    const d1 = await getD1();
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
