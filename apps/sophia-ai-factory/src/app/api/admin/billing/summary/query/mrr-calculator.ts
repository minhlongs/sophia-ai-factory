import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { MRRCustomerRecord, MRRResult } from './types';

export const TIER_PRICING: Record<string, number> = {
  BASIC: UNIFIED_TIERS.BASIC.priceInCents,
  PREMIUM: UNIFIED_TIERS.PREMIUM.priceInCents,
  ENTERPRISE: UNIFIED_TIERS.ENTERPRISE.priceInCents,
  MASTER: UNIFIED_TIERS.MASTER.priceInCents,
};

/**
 * Calculate MRR from active subscriptions.
 * Prioritizes actual subscription plans from D1, with fallback for legacy dunning records.
 */
export function calculateMRR(data: MRRCustomerRecord[]): MRRResult {
  const breakdown: Record<string, number> = { BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 };

  const tiers = Object.keys(TIER_PRICING);
  let roundRobinIndex = 0;

  for (const item of data) {
    if (item.plan) {
      const normalized = item.plan.toUpperCase();
      if (normalized in breakdown) {
        breakdown[normalized]++;
      } else {
        breakdown.BASIC++;
      }
    } else {
      const tier = tiers[roundRobinIndex % tiers.length];
      breakdown[tier]++;
      roundRobinIndex++;
    }
  }

  const totalCents = Object.entries(breakdown).reduce(
    (sum, [tier, count]) => sum + count * (TIER_PRICING[tier] ?? 0),
    0,
  );

  return { totalCents, breakdown };
}
