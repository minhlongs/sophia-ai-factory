/**
 * Zero-touch founder bootstrap hook.
 *
 * Automatically elevates a user to 'admin' role and 'MASTER' tier upon signup
 * if their email matches the FOUNDER_EMAIL environment variable.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface BootstrapUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Checks if the user's email matches FOUNDER_EMAIL (case-insensitive, comma-delimited).
 * If matched:
 * - Updates "user" table: role = 'admin'
 * - Updates user_profiles table: role = 'admin', subscription_tier = 'MASTER'
 * - Updates subscriptions table: tier = 'MASTER', plan = 'master'
 * - Records an immutable audit log entry in admin_audit_log
 *
 * Fail-safe: wrapped in try/catch to never disrupt the user signup flow.
 */
export async function bootstrapFounderIfConfigured(
  user: BootstrapUser
): Promise<boolean> {
  // Feature flag check (allows disabling bootstrap explicitly via environment)
  if (process.env.FOUNDER_BOOTSTRAP_ENABLED === 'false') {
    return false;
  }

  const founderEmailConfig = process.env.FOUNDER_EMAIL;
  if (!founderEmailConfig || !user.email || !user.id) {
    return false;
  }

  const founderEmails = founderEmailConfig
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes('@'));

  const normalizedUserEmail = user.email.trim().toLowerCase();
  if (!founderEmails.includes(normalizedUserEmail)) {
    return false;
  }

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
      .prepare('UPDATE "user" SET role = \'admin\' WHERE id = ?1')
      .bind(user.id);

    const updateProfileStmt = db
      .prepare(
        'UPDATE user_profiles SET role = \'admin\', subscription_tier = \'MASTER\' WHERE user_id = ?1'
      )
      .bind(user.id);

    const updateSubStmt = db
      .prepare(
        'UPDATE subscriptions SET tier = \'MASTER\', plan = \'master\' WHERE user_id = ?1'
      )
      .bind(user.id);

    const auditLogStmt = db
      .prepare(
        'INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at) VALUES (?1, ?2, \'FOUNDER_BOOTSTRAP\', ?3, ?4, ?5)'
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
