/**
 * Revoke all active sessions for a given user.
 *
 * Invoked upon password reset or password change to ensure that any active sessions
 * across devices, browsers, or stale tokens are immediately invalidated in D1.
 *
 * Hardening resolution for Forensic Audit Architectural Risk #10:
 * "Session Token Invalidation on Password Reset / Update".
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface RevokeSessionsResult {
  success: boolean;
  revokedCount: number;
  error?: string;
}

/**
 * Invalidate all active sessions in D1 for the target user.
 *
 * @param userId - Unique identifier of the user whose sessions should be revoked
 * @param db - Optional explicit D1Database instance (e.g. from request context)
 */
export async function revokeAllUserSessions(
  userId: string,
  db?: D1Database | null,
): Promise<RevokeSessionsResult> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    logger.warn('[revokeAllUserSessions] Invalid userId provided', { userId });
    return { success: false, revokedCount: 0, error: 'Invalid userId' };
  }

  const cleanUserId = userId.trim();

  try {
    const database = db ?? (await getD1());
    if (!database) {
      throw new Error('D1 database binding not available');
    }

    // 1. Delete any MFA pending sessions linked to this user's active sessions
    await database
      .prepare(
        `DELETE FROM mfa_pending_sessions 
         WHERE session_id IN (SELECT id FROM "session" WHERE userId = ?1)`,
      )
      .bind(cleanUserId)
      .run()
      .catch((err: unknown) => {
        // Non-fatal if table doesn't exist or foreign key cascade handles it
        logger.warn('[revokeAllUserSessions] mfa_pending_sessions cleanup non-fatal', {
          userId: cleanUserId,
          error: toError(err).message,
        });
      });

    // 2. Delete all sessions for this user from the Better Auth "session" table
    const result = await database
      .prepare('DELETE FROM "session" WHERE userId = ?1')
      .bind(cleanUserId)
      .run();

    const revokedCount = result.meta?.changes ?? 0;

    // 3. Update "user".updatedAt so any timestamp comparison reflects the revocation
    await database
      .prepare('UPDATE "user" SET updatedAt = ?1 WHERE id = ?2')
      .bind(new Date().toISOString(), cleanUserId)
      .run()
      .catch(() => {});

    logger.info('[revokeAllUserSessions] Successfully revoked all user sessions', {
      userId: cleanUserId,
      revokedCount,
    });

    return {
      success: true,
      revokedCount,
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('[revokeAllUserSessions] Failed to revoke sessions', error, { userId: cleanUserId });
    return {
      success: false,
      revokedCount: 0,
      error: error.message,
    };
  }
}
