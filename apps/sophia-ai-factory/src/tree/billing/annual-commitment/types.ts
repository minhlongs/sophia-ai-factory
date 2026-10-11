/**
 * Annual Commitment & Proration Types and Tier Definitions
 * Layer: tree/billing (Pure domain service)
 *
 * @module tree/billing/annual-commitment/types
 */

export interface TierDefinition {
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
export const TIER_COMMITMENTS: Record<string, TierDefinition> = {
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
