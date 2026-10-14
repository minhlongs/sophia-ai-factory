import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { hasWorkspaceRole } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { RollbackActionError } from './types';

export async function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  const d1 = await getD1();
  if (!d1) return null;
  return await resolveOrgId(userId, d1);
}

export async function assertWorkspaceAdmin(
  userId: string,
  workspaceId: string,
): Promise<Result<void, RollbackActionError>> {
  try {
    const d1 = await getD1();
    if (!d1) return failure({ code: 'DB_ERROR', message: 'Database not available' });

    const isAdmin = await hasWorkspaceRole(workspaceId, userId, 'ADMIN', d1);
    if (!isAdmin) {
      return failure({
        code: 'FORBIDDEN',
        message: 'Only workspace owners or admins can trigger rollback',
      });
    }

    return success(undefined);
  } catch (err) {
    const message = toError(err).message;
    logger.error('[RollbackAction] workspace admin check failed', {
      error: message,
      userId,
      workspaceId,
    });
    return failure({ code: 'DB_ERROR', message });
  }
}
