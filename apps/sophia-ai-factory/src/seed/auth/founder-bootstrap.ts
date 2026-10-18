/**
 * Zero-touch founder bootstrap hook.
 *
 * Automatically elevates a user to 'admin' role and 'MASTER' tier upon signup
 * if their email matches the FOUNDER_EMAIL environment variable.
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  type BootstrapUser,
  verifyFounderEmailStatus,
  executeFounderPromotion,
} from './founder-bootstrap-db';

export type { BootstrapUser } from './founder-bootstrap-db';

/**
 * Checks if the user's email matches FOUNDER_EMAIL (case-insensitive, comma-delimited).
 * If matched:
 * - Updates "user" table: role = 'admin'
 * - Updates user_profiles table: role = 'admin', subscription_tier = 'MASTER'
 * - Updates subscriptions table: tier = 'MASTER', plan = 'master'
 * - Records an immutable audit log entry in admin_audit_log
 *
 * Fail-closed security rule:
 * Rejects promotion if emailVerified is false or 0. Checks user.emailVerified first,
 * falling back to checking D1 "user".emailVerified before any role/tier elevation.
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

  // Fail-closed gate: verify that the email address is verified before elevating privileges
  const isEmailVerified = await verifyFounderEmailStatus(user);

  if (!isEmailVerified) {
    logger.warn(
      '[FounderBootstrap] Refusing to elevate unverified user to founder/admin role (fail-closed)',
      undefined,
      {
        userId: user.id,
        email: user.email,
      }
    );
    return false;
  }

  return executeFounderPromotion(user);
}
