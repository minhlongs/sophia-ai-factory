/**
 * Enterprise Billing Quotes & Adjustments
 *
 * @module seed/types/enterprise-billing-quotes
 */

import type { SupportedCurrency } from './enterprise-billing-primitives';

export interface AnnualCommitmentQuote {
  tier: string;
  billingCycle: 'annual';
  currency: SupportedCurrency;
  monthlyPriceCents: number;
  annualPriceCents: number;
  discountPercentage: number;
  monthsFree: number;
  savingsCents: number;
  fxRate: number;
  convertedMonthlyPrice: string;
  convertedAnnualPrice: string;
  convertedSavings: string;
}

export interface ProrationAdjustment {
  currentTier: string;
  newTier: string;
  daysRemainingInCycle: number;
  totalDaysInCycle: number;
  unusedAmountCents: number;
  proratedNewTierCents: number;
  netAmountDueCents: number;
  creditCents: number;
  isUpgrade: boolean;
  currency: SupportedCurrency;
  fxRate: number;
}
