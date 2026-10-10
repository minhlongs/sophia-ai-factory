/**
 * role-guard.ts — Land Layer
 * MASTER-tier authorization guard for organization management
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/**
 * Authorization helper: verifies current session user has admin or MASTER tier.
 */
export async function requireMaster(): Promise<
  Result<{ userId: string }, { code: string; message: string }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const { isAdmin } = await isUserAdminWithRole(user);
    if (isAdmin || user.role === 'admin') {
      return success({ userId: user.id });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const tierRow = await db
      .prepare('SELECT tier FROM subscriptions WHERE user_id = ?1 AND status = \'active\' LIMIT 1')
      .bind(user.id)
      .first<{ tier: string }>();

    if (!tierRow || tierRow.tier !== 'MASTER') {
      return failure({ code: 'FORBIDDEN', message: 'MASTER tier required' });
    }

    return success({ userId: user.id });
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] requireMaster failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
