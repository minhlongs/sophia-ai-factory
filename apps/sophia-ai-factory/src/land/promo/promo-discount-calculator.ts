/**
 * Calculate discount from promo code validation result.
 * Pure function — no I/O, no side effects.
 * @module land/promo/promo-discount-calculator
 */

import type { DiscountType } from './promo-types';

export interface DiscountCalcInput {
  discountType: DiscountType;
  discountValue: number;
  originalAmountCents: number;
}

export interface DiscountCalcResult {
  discountCents: number;
  finalAmountCents: number;
  trialDays: number;
  isFreeOrder: boolean;
}

export function calculateDiscount(input: DiscountCalcInput): DiscountCalcResult {
  const { discountType, discountValue, originalAmountCents } = input;

  switch (discountType) {
    case 'percent_off': {
      const pct = Math.min(Math.max(discountValue, 0), 100);
      const discountCents = Math.round(originalAmountCents * (pct / 100));
      return {
        discountCents,
        finalAmountCents: originalAmountCents - discountCents,
        trialDays: 0,
        isFreeOrder: discountCents >= originalAmountCents,
      };
    }
    case 'fixed_off': {
      const discountCents = Math.min(Math.round(discountValue * 100), originalAmountCents);
      return {
        discountCents,
        finalAmountCents: originalAmountCents - discountCents,
        trialDays: 0,
        isFreeOrder: discountCents >= originalAmountCents,
      };
    }
    case 'free_trial': {
      return {
        discountCents: 0,
        finalAmountCents: originalAmountCents,
        trialDays: Math.max(Math.round(discountValue), 0),
        isFreeOrder: false,
      };
    }
    case 'free_full': {
      return {
        discountCents: originalAmountCents,
        finalAmountCents: 0,
        trialDays: 0,
        isFreeOrder: true,
      };
    }
  }
}

export interface PromoDiscountResult {
  applied: boolean;
  discountUsd: number;
  finalUsd: number;
  finalVnd: number;
  promoCode?: string;
}

const TIER_BASE_USD: Record<'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER', number> = {
  BASIC: 199,
  PREMIUM: 399,
  ENTERPRISE: 799,
  MASTER: 4999,
};

const DEFAULT_USD_TO_VND = 25000;

/**
 * Calculates promo discounts for subscription tiers.
 * Specifically supports SOLO100 for Starter ($199 -> $99) and Growth ($399 -> $299).
 */
export function calculatePromoDiscount(
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER',
  promoCode?: string
): PromoDiscountResult {
  const baseUsd = TIER_BASE_USD[tier] ?? 199;
  const rate = process.env.USD_TO_VND ? Number(process.env.USD_TO_VND) || DEFAULT_USD_TO_VND : DEFAULT_USD_TO_VND;

  const normalizedCode = promoCode?.trim().toUpperCase();

  if (normalizedCode === 'SOLO100') {
    // SOLO100 gives $100 off Starter ($199 -> $99/mo) and Growth ($399 -> $299/mo)
    if (tier === 'BASIC' || tier === 'PREMIUM') {
      const discountUsd = 100;
      const finalUsd = Math.max(0, baseUsd - discountUsd);
      const finalVnd = finalUsd * rate;

      return {
        applied: true,
        discountUsd,
        finalUsd,
        finalVnd,
        promoCode: 'SOLO100',
      };
    }
  }

  return {
    applied: false,
    discountUsd: 0,
    finalUsd: baseUsd,
    finalVnd: baseUsd * rate,
    promoCode: normalizedCode || undefined,
  };
}
