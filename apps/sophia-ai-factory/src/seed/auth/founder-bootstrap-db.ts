/**
 * Founder Bootstrap Database Operations
 *
 * Handles D1 verification of email status and atomic role/tier promotion
 * for founder accounts.
 *
 * @module seed/auth/founder-bootstrap-db
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface BootstrapUser {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean | number | null;
}

/**
 * Verifies whether the user's email is marked as verified in memory or in D1.
 */
export async function verifyFounderEmailStatus(user: BootstrapUser): Promise<boolean> {
  if (Boolean(user.emailVerified)) {
    return true;
  }

  try {
    const db = await getD1();
    if (db) {
      const row = await db
        .prepare('SELECT emailVerified FROM "user" WHERE id = ?1 LIMIT 1')
        .bind(user.id)
        .first<{ emailVerified?: boolean | number | null }>();
      if (row && (row.emailVerified === true || row.emailVerified === 1)) {
        return true;
      }
    }
  } catch (err) {
    logger.warn('[FounderBootstrap] Failed checking emailVerified in database', toError(err), {
      userId: user.id,
    });
  }

  return false;
}

/**
 * Executes the D1 role/tier promotion and records an immutable audit log entry.
 */
export async function executeFounderPromotion(user: BootstrapUser): Promise<boolean> {
  try {
    const db = await getD1();
    if (!db) {
      logger.error('[FounderBootstrap] D1 database not available for founder bootstrap', undefined, {
        userId: user.id,
        email: user.email,
      });
      return false;
    }

    const auditId = crypto.randomUUID();
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      email: user.email,
      promotedRole: 'admin',
      tier: 'MASTER',
      source: 'FOUNDER_EMAIL_ENV',
      bootstrappedAt: new Date().toISOString(),
    });

    const updateUserStmt = db
      .prepare("UPDATE \"user\" SET role = 'admin' WHERE id = ?1")
      .bind(user.id);

    const updateProfileStmt = db
      .prepare(
        "UPDATE user_profiles SET role = 'admin', subscription_tier = 'MASTER' WHERE user_id = ?1"
      )
      .bind(user.id);

    const updateSubStmt = db
      .prepare(
        "UPDATE subscriptions SET tier = 'MASTER', plan = 'master' WHERE user_id = ?1"
      )
      .bind(user.id);

    const auditLogStmt = db
      .prepare(
        "INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at) VALUES (?1, ?2, 'FOUNDER_BOOTSTRAP', ?3, ?4, ?5)"
      )
      .bind(auditId, user.id, user.id, payload, nowSec);

    if (typeof db.batch === 'function') {
      await db.batch([
        updateUserStmt,
        updateProfileStmt,
        updateSubStmt,
        auditLogStmt,
      ]);
    } else {
      await updateUserStmt.run();
      await updateProfileStmt.run();
      await updateSubStmt.run();
      await auditLogStmt.run();
    }

    logger.info('[FounderBootstrap] Successfully bootstrapped founder account', {
      userId: user.id,
      email: user.email,
      auditId,
    });

    return true;
  } catch (err) {
    const error = toError(err);
    logger.error('[FounderBootstrap] Founder bootstrap failed', error, {
      userId: user.id,
      email: user.email,
    });
    return false;
  }
}
