/**
 * LTV (Lifetime Value) calculator.
 *
 * LTV = ARPU × avgLifetimeMonths (per tier)
 * ARPU = tier.mrr / tier.customers (from RevenueSnapshot)
 * avgLifetimeMonths = 1 / monthly_churn_rate  (capped at 24 months)
 *
 * Depends on Phase 03 fetchRevenueSnapshot for ARPU inputs.
 */

import { fetchRevenueSnapshot } from '@/land/analytics/queries/revenue-nowpayments';
import { fetchChurnTimeline } from './churn-calculator';
import { logger } from '@/seed/utils/logger-utility';
import { TIER_CONFIGS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import type { TierLTVRow, LTVByTier, CACOverrideMap } from '@/seed/types/analytics-cohort';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_LIFETIME_MONTHS = 24;
const MIN_CHURN_RATE = 1 / MAX_LIFETIME_MONTHS; // floor: implies 24-month max lifetime

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive avg lifetime from churn rate.
 * lifetime = 1 / monthlyChurnRate, capped at MAX_LIFETIME_MONTHS.
 */
function lifetimeFromChurnRate(monthlyChurnRate: number): number {
  if (monthlyChurnRate <= 0) return MAX_LIFETIME_MONTHS;
  const effectiveRate = Math.max(monthlyChurnRate / 100, MIN_CHURN_RATE);
  return Math.min(Math.round((1 / effectiveRate) * 10) / 10, MAX_LIFETIME_MONTHS);
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Calculate LTV per tier.
 *
 * @param db          - D1Database binding
 * @param cacOverride - Optional CAC per tier in USD for LTV:CAC ratio
 */
export async function calculateLTVByTier(
  db: D1Database,
  cacOverride?: CACOverrideMap,
): Promise<LTVByTier> {
  // ── Fetch revenue snapshot for ARPU ──
  const snapshot = await fetchRevenueSnapshot('30d');
  const { avgMonthlyChurnRate } = await fetchChurnTimeline(db, 90);

  const tiers: TierLTVRow[] = [];
  const allTiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

  for (const tier of allTiers) {
    const revenueRow = snapshot.byTier.find(r => r.tier === tier);
    const customers = revenueRow?.customers ?? 0;
    const tierPrice = TIER_CONFIGS[tier]?.price ?? 0;

    // ARPU: use snapshot MRR / customers if available, else fall back to tier price
    const arpu = customers > 0 && revenueRow
      ? Math.round((revenueRow.mrr / customers) * 100) / 100
      : tierPrice;

    const avgLifetimeMonths = lifetimeFromChurnRate(avgMonthlyChurnRate);
    const ltv = Math.round(arpu * avgLifetimeMonths * 100) / 100;

    tiers.push({ tier, arpu, avgLifetimeMonths, ltv, customers });
  }

  // ── LTV:CAC ratios (optional) ──
  let ltvCacRatios: Record<string, number | null> | undefined;

  if (cacOverride && Object.keys(cacOverride).length > 0) {
    ltvCacRatios = {};
    for (const row of tiers) {
      const cac = cacOverride[row.tier];
      if (typeof cac === 'number' && cac > 0) {
        ltvCacRatios[row.tier] = Math.round((row.ltv / cac) * 100) / 100;
      } else {
        ltvCacRatios[row.tier] = null;
      }
    }
  }

  logger.info('[LTVCalculator] Calculated LTV by tier', {
    avgMonthlyChurnRate,
    tierCount: tiers.length,
  });

  return { tiers, ltvCacRatios };
}
