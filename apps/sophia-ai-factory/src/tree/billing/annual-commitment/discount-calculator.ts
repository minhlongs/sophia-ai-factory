/**
 * Annual Commitment Discount Calculator
 * Layer: tree/billing (Pure domain service)
 *
 * @module tree/billing/annual-commitment/discount-calculator
 */

import type {
  SupportedCurrency,
  FxRateMap,
  AnnualCommitmentQuote,
} from '@/seed/types/enterprise-billing';
import { convertCurrency, formatCurrency } from '../fx-converter';
import { TIER_COMMITMENTS, type TierDefinition } from './types';

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
export function resolveTierDefinition(tierInput: string): TierDefinition {
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
