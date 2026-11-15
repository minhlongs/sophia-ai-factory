/**
 * Get user's subscription tier from D1.
 * Reads 'plan' column from subscriptions table (stored lowercase per
 * migration 0001) and normalizes via DB_TIER_MAPPING to the uppercase
 * Tier enum. Returns 'BASIC' on any miss.
 *
 * Reads entitlement directly from D1. Paid-tier authorization must not rely on
 * Workers KV because its global cache is eventually consistent and can retain
 * a refunded tier after the webhook has completed.
 */

import { Tier } from '@/seed/types';
import { getD1 } from '@/seed/db/client';
import { invalidateUserTierCache, invalidateUserTierCacheAsync, clearUserTierCache, normalizePlanToTier } from './user-tier-cache';

export { invalidateUserTierCache, invalidateUserTierCacheAsync, clearUserTierCache, normalizePlanToTier };

export async function getUserTier(userId: string): Promise<Tier> {
  if (!userId) return 'BASIC' as Tier;

  try {
    const d1 = await getD1();
    if (!d1) return 'BASIC' as Tier;

    const nowIso = new Date(Date.now()).toISOString();

    // Resolve direct and org-scoped subscriptions in one D1 read. Select the
    // newest direct row first even if its tier is null, then use the legacy
    // single-membership fallback instead of reviving older or other-org tiers.
    // Enforce current_period_end > nowIso when set so expired pilot/monthly rows
    // never continue granting paid entitlements if a cron sweep lags.
    const subscription = await d1
      .prepare(
        `WITH direct AS (
           SELECT COALESCE(tier, plan) AS raw_tier
           FROM subscriptions
           WHERE user_id = ?1 AND status = 'active'
             AND (current_period_end IS NULL OR current_period_end > ?2)
           ORDER BY created_at DESC
           LIMIT 1
         )
         SELECT COALESCE(
           (SELECT raw_tier FROM direct),
           (SELECT s.plan
            FROM subscriptions s
            WHERE s.org_id = (SELECT org_id FROM org_members WHERE user_id = ?1 LIMIT 1)
              AND s.status = 'active' AND s.plan IS NOT NULL
              AND (s.current_period_end IS NULL OR s.current_period_end > ?2)
            ORDER BY s.created_at DESC
            LIMIT 1)
         ) AS raw_tier`,
      )
      .bind(userId, nowIso)
      .first<{ raw_tier: string | null }>();

    return normalizePlanToTier(subscription?.raw_tier);
  } catch {
    return 'BASIC' as Tier;
  }
}
