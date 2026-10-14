/**
 * Tier contract term calculation helper for ASC 606 revenue recognition.
 * @module tree/finance/recognition/amortization-terms
 */

import type { RevenueScheduleTier, BillingCycle } from '@/seed/types/financial-close';
import {
  CANONICAL_TIER_PRICES_CENTS,
  MASTER_ECONOMIC_LIFE_DAYS,
  formatDateIso,
  addDaysIso,
  diffCalendarDays,
} from './types';

/**
 * Calculate contract terms, term days, end date, and daily accrual rate
 */
export function calculateTierContractTerms(
  tier: RevenueScheduleTier,
  billingCycle: BillingCycle,
  customValueCents?: number,
  startDateStr?: string,
  endDateStr?: string,
): {
  totalValueCents: number;
  termDays: number;
  dailyRateCents: number;
  startDate: string;
  endDate: string;
} {
  const startDate = startDateStr ?? formatDateIso(new Date());

  let totalValueCents = customValueCents;
  if (totalValueCents === undefined || totalValueCents <= 0) {
    const tierCycleMap = CANONICAL_TIER_PRICES_CENTS[tier] ?? CANONICAL_TIER_PRICES_CENTS.BASIC;
    totalValueCents = tierCycleMap[billingCycle] ?? 19900;
  }

  let termDays: number;
  let endDate: string;

  if (tier === 'MASTER' || billingCycle === 'lifetime') {
    termDays = MASTER_ECONOMIC_LIFE_DAYS;
    endDate = endDateStr ?? addDaysIso(startDate, termDays);
  } else if (billingCycle === 'annual') {
    termDays = 365;
    endDate = endDateStr ?? addDaysIso(startDate, termDays);
  } else if (billingCycle === 'monthly') {
    termDays = 30;
    endDate = endDateStr ?? addDaysIso(startDate, termDays);
  } else {
    if (endDateStr) {
      endDate = endDateStr;
      termDays = diffCalendarDays(startDate, endDateStr);
    } else {
      termDays = 30;
      endDate = addDaysIso(startDate, termDays);
    }
  }

  const dailyRateCents = totalValueCents / termDays;

  return {
    totalValueCents,
    termDays,
    dailyRateCents,
    startDate,
    endDate,
  };
}
