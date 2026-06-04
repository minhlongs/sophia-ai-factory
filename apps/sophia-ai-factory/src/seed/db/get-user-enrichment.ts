/**
 * User Enrichment — batched per-user data for dashboard layout.
 *
 * Replaces 3 parallel D1 queries (getUserTrialEndsAt + getUserTier +
 * getRedeemedPromoCode) with a single joined query.
 *
 * Architecture:
 *   - Direct subscriptions + user_profiles lookup (1 query, primary path)
 *   - Falls back to org-based tier resolution if user-scoped sub is missing
 *     (preserves existing getUserTier fallback behavior)
 *   - Promo code from most recent redemption
 *
 * Returns null on any failure — callers handle graceful degradation.
 */

import { getD1Safe } from '@/seed/db/client';
import { normalizePlanToTier } from '@/seed/db/get-user-tier';
import { Tier } from '@/seed/types';

export interface UserEnrichment {
  tier: Tier;
  trialEndsAt: number | null;
  redeemedPromoCode: string | null;
  role: string | null; // 'admin' | 'user' | null — used for unified admin gate (F08)
}

export async function getUserEnrichment(
  userId: string,
): Promise<UserEnrichment | null> {
  const db = await getD1Safe();
  if (!db) return null;

  try {
    // Single batched query: subscriptions + user_profiles + promo_code_redemptions
    const row = await db
      .prepare(
        `SELECT
          COALESCE(s.tier, s.plan)           AS raw_tier,
          s.trial_ends_at,
          up.subscription_tier                AS profile_tier,
          up.role                             AS user_role,
          (
            SELECT pcr.promo_code
            FROM promo_code_redemptions pcr
            WHERE pcr.user_id = ?
            ORDER BY pcr.redeemed_at DESC
            LIMIT 1
          )                                    AS redeemed_promo_code
        FROM subscriptions s
        LEFT JOIN user_profiles up ON up.user_id = s.user_id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC
        LIMIT 1`,
      )
      .bind(userId, userId)
      .first<{
        raw_tier: string | null;
        trial_ends_at: number | null;
        profile_tier: string | null;
        user_role: string | null;
        redeemed_promo_code: string | null;
      }>();

    if (row) {
      const rawTier = row.raw_tier ?? row.profile_tier;
      const tier = rawTier ? normalizePlanToTier(rawTier) : ('BASIC' as Tier);

      return {
        tier,
        trialEndsAt: row.trial_ends_at,
        redeemedPromoCode: row.redeemed_promo_code,
        role: row.user_role,
      };
    }

    // No user-scoped subscription — fall back to org-based tier resolution
    // (preserves getUserTier fallback for org-scoped customers)
    const profile = await db
      .prepare('SELECT role FROM user_profiles WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ role: string | null }>();

    const member = await db
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ org_id: string }>();

    if (!member) {
      return {
        tier: 'BASIC' as Tier,
        trialEndsAt: null,
        redeemedPromoCode: null,
        role: profile?.role ?? null,
      };
    }

    const orgSub = await db
      .prepare(
        "SELECT COALESCE(tier, plan) AS raw_tier FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1",
      )
      .bind(member.org_id)
      .first<{ raw_tier: string | null }>();

    return {
      tier: orgSub?.raw_tier ? normalizePlanToTier(orgSub.raw_tier) : ('BASIC' as Tier),
      trialEndsAt: null,
      redeemedPromoCode: null,
      role: profile?.role ?? null,
    };
  } catch {
    return null;
  }
}
