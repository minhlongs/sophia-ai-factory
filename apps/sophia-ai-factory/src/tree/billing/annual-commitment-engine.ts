/**
 * Annual Commitment & Dynamic Proration Engine
 *
 * Implements 20% discount (equivalent to 2 months free) on annual commitments
 * across unified tiers: STARTER, CREATOR, PRO, AGENCY, ENTERPRISE, MASTER.
 * Provides dynamic proration calculations for upgrades and downgrades with
 * support for multi-currency conversion (USD, VND, EUR, JPY, SGD) and leap-year cycles.
 *
 * Layer: tree/billing (Pure domain service)
 *
 * @module tree/billing/annual-commitment-engine
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  SupportedCurrency,
  FxRateMap,
  AnnualCommitmentQuote,
  ProrationAdjustment,
} from '@/seed/types/enterprise-billing';
import { convertCurrency, formatCurrency } from './fx-converter';

interface TierDefinition {
  canonicalName: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  discountPercentage: number;
  monthsFree: number;
  rank: number;
}

/**
 * Single source of truth for unified commitment tiers.
 * 20% discount / 2 months free: 12 months for the price of 10 months.
 */
const TIER_COMMITMENTS: Record<string, TierDefinition> = {
  STARTER: {
    canonicalName: 'STARTER',
    monthlyPriceCents: 19900, // $199/mo
    annualPriceCents: 199000, // $1,990/yr (10 months price = 2 months free)
    discountPercentage: 20,
    monthsFree: 2,
    rank: 1,
  },
  CREATOR: {
    canonicalName: 'CREATOR',
    monthlyPriceCents: 39900, // $399/mo
    annualPriceCents: 399000, // $3,990/yr (10 months price = 2 months free)
    discountPercentage: 20,
    monthsFree: 2,
    rank: 2,
  },
  PRO: {
    canonicalName: 'PRO',
    monthlyPriceCents: 49900, // $499/mo
    annualPriceCents: 499000, // $4,990/yr (10 months price = 2 months free)
    discountPercentage: 20,
    monthsFree: 2,
    rank: 3,
  },
  AGENCY: {
    canonicalName: 'AGENCY',
    monthlyPriceCents: 69900, // $699/mo
    annualPriceCents: 699000, // $6,990/yr (10 months price = 2 months free)
    discountPercentage: 20,
    monthsFree: 2,
    rank: 4,
  },
  ENTERPRISE: {
    canonicalName: 'ENTERPRISE',
    monthlyPriceCents: 79900, // $799/mo
    annualPriceCents: 799000, // $7,990/yr (10 months price = 2 months free)
    discountPercentage: 20,
    monthsFree: 2,
    rank: 5,
  },
  MASTER: {
    canonicalName: 'MASTER',
    monthlyPriceCents: 499900, // $4,999/mo or equivalent
    annualPriceCents: 4999000, // $49,990/yr (10 months price = 2 months free)
    discountPercentage: 20,
    monthsFree: 2,
    rank: 6,
  },
};

/**
 * Normalizes input tier names, accepting lowercase and historical aliases.
 */
export function normalizeTierKey(tierInput: string): string {
  const clean = (tierInput || '').trim().toUpperCase();
  switch (clean) {
    case 'BASIC':
    case 'STARTER':
      return 'STARTER';
    case 'PREMIUM':
    case 'GROWTH':
    case 'CREATOR':
      return 'CREATOR';
    case 'PRO':
      return 'PRO';
    case 'AGENCY':
      return 'AGENCY';
    case 'ENTERPRISE':
      return 'ENTERPRISE';
    case 'MASTER':
      return 'MASTER';
    default:
      return clean;
  }
}

/**
 * Resolve tier definition or throw if unrecognized.
 */
function resolveTierDefinition(tierInput: string): TierDefinition {
  const normalized = normalizeTierKey(tierInput);
  const def = TIER_COMMITMENTS[normalized];
  if (!def) {
    throw new Error(
      `Unknown tier: "${tierInput}". Supported tiers: ${Object.keys(TIER_COMMITMENTS).join(', ')}`,
    );
  }
  return def;
}

/**
 * Calculate annual commitment quote with 20% discount (2 months free).
 * Supports real-time dynamic currency conversion and formatting.
 */
export function calculateAnnualCommitmentQuote(
  tier: string,
  currency: SupportedCurrency = 'USD',
  fxRates?: FxRateMap,
): AnnualCommitmentQuote {
  const def = resolveTierDefinition(tier);

  const fullAnnualWithoutDiscountCents = def.monthlyPriceCents * 12;
  const annualPriceCents = def.annualPriceCents;
  const savingsCents = fullAnnualWithoutDiscountCents - annualPriceCents;

  const { convertedCents: convertedMonthlyCents, rate: fxRate } = convertCurrency(
    def.monthlyPriceCents,
    'USD',
    currency,
    fxRates,
  );

  const { convertedCents: convertedAnnualCents } = convertCurrency(
    annualPriceCents,
    'USD',
    currency,
    fxRates,
  );

  const { convertedCents: convertedSavingsCents } = convertCurrency(
    savingsCents,
    'USD',
    currency,
    fxRates,
  );

  return {
    tier: def.canonicalName,
    billingCycle: 'annual',
    currency,
    monthlyPriceCents: def.monthlyPriceCents,
    annualPriceCents,
    discountPercentage: def.discountPercentage,
    monthsFree: def.monthsFree,
    savingsCents,
    fxRate,
    convertedMonthlyPrice: formatCurrency(convertedMonthlyCents, currency),
    convertedAnnualPrice: formatCurrency(convertedAnnualCents, currency),
    convertedSavings: formatCurrency(convertedSavingsCents, currency),
  };
}

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
