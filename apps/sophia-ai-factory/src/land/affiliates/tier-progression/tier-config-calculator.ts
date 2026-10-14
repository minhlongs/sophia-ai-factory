import {
  AffiliateTier,
  AffiliateTierConfig,
  AFFILIATE_TIER_CONFIGS,
} from '@/seed/types/affiliate-expansion-types';

/**
 * Determine the canonical affiliate tier config for a given MRR in cents.
 */
export function getTierForMrr(mrrCents: number): AffiliateTierConfig {
  const safeCents = Math.max(0, Math.floor(mrrCents));

  if (safeCents >= AFFILIATE_TIER_CONFIGS.PLATINUM.minMrrCents) {
    return AFFILIATE_TIER_CONFIGS.PLATINUM;
  }
  if (safeCents >= AFFILIATE_TIER_CONFIGS.GOLD.minMrrCents) {
    return AFFILIATE_TIER_CONFIGS.GOLD;
  }
  return AFFILIATE_TIER_CONFIGS.SILVER;
}

/**
 * Calculate dual-tier recurring commission based on tier configuration and order amount.
 */
export function calculateDualTierCommission(
  tier: AffiliateTier,
  orderAmountCents: number,
  isTier2 = false
): {
  ratePct: number;
  commissionCents: number;
  tier: AffiliateTier | 'TIER2';
  isTier2: boolean;
} {
  if (orderAmountCents <= 0) {
    return {
      ratePct: 0,
      commissionCents: 0,
      tier: isTier2 ? 'TIER2' : tier,
      isTier2,
    };
  }

  const config = AFFILIATE_TIER_CONFIGS[tier] || AFFILIATE_TIER_CONFIGS.SILVER;

  if (isTier2) {
    const ratePct = config.tier2RatePct;
    const commissionCents = Math.round(orderAmountCents * (ratePct / 100));
    return {
      ratePct,
      commissionCents,
      tier: 'TIER2',
      isTier2: true,
    };
  }

  const ratePct = config.commissionRatePct;
  const commissionCents = Math.round(orderAmountCents * (ratePct / 100));

  return {
    ratePct,
    commissionCents,
    tier: config.tier,
    isTier2: false,
  };
}
