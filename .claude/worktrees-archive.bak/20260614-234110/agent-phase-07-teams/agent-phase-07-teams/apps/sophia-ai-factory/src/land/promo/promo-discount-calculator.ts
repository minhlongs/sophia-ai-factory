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
