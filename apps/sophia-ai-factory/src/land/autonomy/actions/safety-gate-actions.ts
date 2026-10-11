import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { AutonomyActionError } from './types';

export async function getPrimaryWorkspaceId(userId: string): Promise<string | null> {
  try {
    const d1 = await getD1();
    if (!d1) return null;
    return await resolveOrgId(userId, d1);
  } catch {
    return null;
  }
}

export async function assertWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<Result<void, AutonomyActionError>> {
  try {
    const d1 = await getD1();
    if (!d1) return failure({ code: 'DB_ERROR', message: 'Database not available' });
    const hasAccess = await verifyWorkspaceAccess(workspaceId, userId, d1);
    if (!hasAccess) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have access to this workspace' });
    }
    return success(undefined);
  } catch (err) {
    const message = toError(err).message;
    logger.error('[AutonomyAction] membership check failed', { error: message, userId, workspaceId });
    return failure({ code: 'DB_ERROR', message });
  }
}
