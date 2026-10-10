/**
 * Subscription tier resolution & rollback operations for refund processing
 * @module land/refunds/processor/eligibility-checker
 */

import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';
import { DB_TIER_MAPPING, TIER_DB_MAPPING } from '@/seed/config/tiers/tier-configs';
import type { SubscriptionRow } from './types';

/**
 * Resolve the current tier for a user by looking up their org subscription.
 * Returns BASIC as fallback if no subscription or org membership found.
 */
export async function resolveCurrentTier(
  userId: string,
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
): Promise<Tier> {
  try {
    const orgId = await resolveOrgId(userId, db);

    if (!orgId) {
      logger.info('[RefundProcessor] No org membership found for user, defaulting to BASIC', { userId });
      return 'BASIC';
    }

    const sub = await db
      .prepare('SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1')
      .bind(orgId)
      .first<SubscriptionRow>();

    if (!sub || sub.status !== 'active') {
      return 'BASIC';
    }

    return DB_TIER_MAPPING[sub.plan] ?? 'BASIC';
  } catch (err) {
    logger.warn('[RefundProcessor] resolveCurrentTier failed, defaulting to BASIC', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'BASIC';
  }
}

/**
 * Roll back the user's subscription tier to the specified fallback tier.
 * Also updates the organization plan.
 */
export async function rollbackTier(
  userId: string,
  targetTier: Tier,
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
): Promise<void> {
  const dbPlan = TIER_DB_MAPPING[targetTier] ?? 'basic';
  const nowSec = Math.floor(Date.now() / 1000);

  // Update subscription plan (skip if already at target to avoid no-op)
  await db
    .prepare(
      `UPDATE subscriptions SET plan = ?1, updated_at = ?2
       WHERE user_id = ?3 AND plan != ?1`,
    )
    .bind(dbPlan, nowSec, userId)
    .run();

  // Update organization plan
  const orgId = await resolveOrgId(userId, db);

  if (orgId) {
    await db
      .prepare(
        `UPDATE organizations SET plan = ?1, updated_at = ?2
         WHERE id = ?3 AND plan != ?1`,
      )
      .bind(dbPlan, nowSec, orgId)
      .run();
  }

  logger.info('[RefundProcessor] Tier rolled back', {
    userId,
    targetTier,
    dbPlan,
    orgId: orgId ?? null,
  });
}
