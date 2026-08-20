/**
 * resolveUserTier — single source of truth for effective user tier.
 *
 * Merge strategy: MAX of subscription tier and affiliate-derived tier.
 *
 * Priority sources:
 * 1. subscriptions table (primary — paid plans from NOWPayments IPN)
 * 2. affiliate_conversions (bonus — significant commission volume maps to tier)
 *
 * Affiliate commission → tier mapping (configurable thresholds):
 * TOTAL_COMMISSION_TIERS = {
 *   BASIC: 0,      // always unlocked
 *   PREMIUM: 50,   // $50+ total commissions
 *   ENTERPRISE: 200, // $200+ total commissions
 *   MASTER: 1000,  // $1,000+ total commissions
 * }
 *
 * A user's effective tier is the highest tier their subscription OR
 * affiliate earnings qualify them for. This closes the gap where
 * affiliate commissions (tracked only in affiliate_conversions) were
 * not reflected in the subscriptions tier used by getTierConfig().
 *
 * All existing callers of getUserTier() should migrate to this function.
 * The original getUserTier() is preserved for backward compatibility.
 *
 * @module seed/db/resolve-user-tier
 */

import { Tier, TIER_RANK } from '@/seed/types'
import { getUserTier } from './get-user-tier'

import { getD1 } from './get-d1';
/** Commission threshold (USD) required to qualify for each tier via affiliate earnings */
const AFFILIATE_TIER_THRESHOLDS: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 50,
  ENTERPRISE: 200,
  MASTER: 1000,
}

/** affiliate_conversions.gross_amount stores the ClickBank amount in USD */

/**
 * Compute tier from total commission volume in affiliate_conversions.
 * Sums gross_amount across all 'available' and 'pending_clearance' rows
 * (excludes 'reversed', 'unattributed', 'underpaid').
 * Returns BASIC if no DB or no conversions found.
 */
// Re-export utilities needed by migrating modules
export { getUserTier, normalizePlanToTier } from './get-user-tier'

async function getAffiliateTier(userId: string): Promise<Tier> {
  try {
    const d1 = await getD1()
    if (!d1) return 'BASIC'

    const row = await d1
      .prepare(
        `SELECT COALESCE(SUM(gross_amount), 0) as total
         FROM affiliate_conversions
         WHERE user_id = ?
         AND payout_status IN ('available', 'pending_clearance')`,
      )
      .bind(userId)
      .first<{ total: number }>()

    if (!row) return 'BASIC'

    const totalUsd = row.total

    // Walk tiers from highest to lowest
    const tiers: Tier[] = ['MASTER', 'ENTERPRISE', 'PREMIUM', 'BASIC']
    for (const tier of tiers) {
      if (totalUsd >= AFFILIATE_TIER_THRESHOLDS[tier]) {
        return tier
      }
    }
    return 'BASIC'
  } catch {
    return 'BASIC'
  }
}

/**
 * Resolve the effective tier for a user by merging subscription tier
 * with affiliate-earned tier. Returns the MAXIMUM of both sources.
 *
 * This is the single source of truth — replace getUserTier() calls
 * with resolveUserTier() throughout the codebase.
 *
 * @param userId - The authenticated user's ID
 * @returns The user's effective tier (BASIC | PREMIUM | ENTERPRISE | MASTER)
 */
export async function resolveUserTier(userId: string): Promise<Tier> {
  const [subscriptionTier, affiliateTier] = await Promise.all([
    getUserTier(userId),
    getAffiliateTier(userId),
  ])

  // Return the higher-ranked tier from either source
  const subRank = TIER_RANK[subscriptionTier] ?? 0
  const affRank = TIER_RANK[affiliateTier] ?? 0
  return subRank >= affRank ? subscriptionTier : affiliateTier
}
