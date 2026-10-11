/**
 * Dynamic Proration Schedule Builder
 * Layer: tree/billing (Pure domain service)
 *
 * @module tree/billing/annual-commitment/schedule-builder
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  SupportedCurrency,
  FxRateMap,
  ProrationAdjustment,
} from '@/seed/types/enterprise-billing';
import { convertCurrency } from '../fx-converter';
import { resolveTierDefinition } from './discount-calculator';

/**
 * Calculate dynamic proration for plan transitions (upgrades & downgrades).
 * Computes remaining unused credit, prorates the new tier for the remaining days,
 * and outputs the net amount due or account credit.
 *
 * Handles boundary conditions:
 * - daysRemainingInCycle <= 0: no unused credit, no charge.
 * - totalDaysInCycle <= 0: throws descriptive error.
 * - daysRemainingInCycle > totalDaysInCycle: capped to totalDaysInCycle.
 * - Leap year: full support when totalDaysInCycle = 366.
 */
export function calculateProratedUpgrade(
  currentTier: string,
  newTier: string,
  daysRemainingInCycle: number,
  totalDaysInCycle: number,
  currency: SupportedCurrency = 'USD',
  fxRates?: FxRateMap,
): ProrationAdjustment {
  if (totalDaysInCycle <= 0) {
    throw new Error(
      `Invalid totalDaysInCycle: ${totalDaysInCycle}. Must be a positive integer (e.g. 30, 365, or 366).`,
    );
  }

  const currentDef = resolveTierDefinition(currentTier);
  const newDef = resolveTierDefinition(newTier);

  // Clamp remaining days to [0, totalDaysInCycle]
  const clampedDaysRemaining = Math.max(0, Math.min(daysRemainingInCycle, totalDaysInCycle));

  // Determine whether this transition is an upgrade based on rank / price
  const isUpgrade = newDef.monthlyPriceCents > currentDef.monthlyPriceCents;

  const remainingRatio = clampedDaysRemaining / totalDaysInCycle;

  // Unused credit from current tier in USD cents
  const unusedAmountUsdCents = Math.round(currentDef.monthlyPriceCents * remainingRatio);

  // Cost of new tier for remaining days in USD cents
  const proratedNewTierUsdCents = Math.round(newDef.monthlyPriceCents * remainingRatio);

  let netAmountDueUsdCents = 0;
  let creditUsdCents = 0;

  if (isUpgrade) {
    netAmountDueUsdCents = Math.max(0, proratedNewTierUsdCents - unusedAmountUsdCents);
    creditUsdCents = 0;
  } else {
    netAmountDueUsdCents = 0;
    creditUsdCents = Math.max(0, unusedAmountUsdCents - proratedNewTierUsdCents);
  }

  // Convert to requested currency
  const { convertedCents: convertedUnused, rate: fxRate } = convertCurrency(
    unusedAmountUsdCents,
    'USD',
    currency,
    fxRates,
  );

  const { convertedCents: convertedNewTier } = convertCurrency(
    proratedNewTierUsdCents,
    'USD',
    currency,
    fxRates,
  );

  const { convertedCents: convertedNetDue } = convertCurrency(
    netAmountDueUsdCents,
    'USD',
    currency,
    fxRates,
  );

  const { convertedCents: convertedCredit } = convertCurrency(
    creditUsdCents,
    'USD',
    currency,
    fxRates,
  );

  logger.info('[AnnualCommitmentEngine] Calculated proration adjustment', {
    currentTier: currentDef.canonicalName,
    newTier: newDef.canonicalName,
    isUpgrade,
    daysRemaining: clampedDaysRemaining,
    totalDays: totalDaysInCycle,
    netDue: convertedNetDue,
    credit: convertedCredit,
    currency,
  });

  return {
    currentTier: currentDef.canonicalName,
    newTier: newDef.canonicalName,
    daysRemainingInCycle: clampedDaysRemaining,
    totalDaysInCycle,
    unusedAmountCents: convertedUnused,
    proratedNewTierCents: convertedNewTier,
    netAmountDueCents: convertedNetDue,
    creditCents: convertedCredit,
    isUpgrade,
    currency,
    fxRate,
  };
}
