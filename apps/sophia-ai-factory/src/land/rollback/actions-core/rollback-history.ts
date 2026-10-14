import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getRollbackHistory, type RollbackRecord } from '@/tree/rollback';
import { RollbackActionError } from './types';
import { getWorkspaceIdForUser } from './helpers';

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

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const workspaceId = await getWorkspaceIdForUser(user.id);
    if (!workspaceId) {
      return failure({ code: 'NOT_FOUND', message: 'No workspace found for this user' });
    }

    // Verify user has membership (read-only check)
    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id, d1);

    if (!hasAccess) {
      return failure({
        code: 'FORBIDDEN',
        message: 'You do not have access to this workspace',
      });
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
