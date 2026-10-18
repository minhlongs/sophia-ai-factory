/**
 * Promo discount calculation and tier normalization helpers.
 * @module land/promo/promo-applier-helpers
 */

import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import type { DiscountType } from './promo-types';

/** Tier price map in cents (used for fixed_off / percent_off calculations). */
const TIER_PRICE_CENTS: Record<string, number> = {
  BASIC: UNIFIED_TIERS.BASIC.priceInCents,
  PREMIUM: UNIFIED_TIERS.PREMIUM.priceInCents,
  ENTERPRISE: UNIFIED_TIERS.ENTERPRISE.priceInCents,
  MASTER: UNIFIED_TIERS.MASTER.priceInCents,
};

const VALID_TIERS = new Set<string>(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']);

export function normalizeTier(tier: string | undefined): Tier {
  const upper = (tier ?? 'BASIC').toUpperCase();
  return (VALID_TIERS.has(upper) ? upper : 'BASIC') as Tier;
}

export function computePromoPricing(params: {
  effectiveTier: Tier;
  paymentAmountCents?: number;
  discountType: DiscountType;
  discountValue: number;
}): {
  originalAmountCents: number;
  discountedAmountCents: number;
  discountAppliedCents: number;
  trialDaysGranted: number;
} {
  const { effectiveTier, paymentAmountCents, discountType, discountValue } = params;
  const originalAmountCents = paymentAmountCents ?? TIER_PRICE_CENTS[effectiveTier] ?? 0;
  let discountedAmountCents = originalAmountCents;
  let trialDaysGranted = 0;

  if (discountType === 'percent_off') {
    const discount = Math.round((originalAmountCents * discountValue) / 100);
    discountedAmountCents = Math.max(0, originalAmountCents - discount);
  } else if (discountType === 'fixed_off') {
    discountedAmountCents = Math.max(0, originalAmountCents - discountValue);
  } else if (discountType === 'free_trial') {
    trialDaysGranted = discountValue;
    discountedAmountCents = 0;
  } else if (discountType === 'free_full') {
    discountedAmountCents = 0;
  }

  return {
    originalAmountCents,
    discountedAmountCents,
    discountAppliedCents: originalAmountCents - discountedAmountCents,
    trialDaysGranted,
  };
}
