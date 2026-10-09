/**
 * Unit Economics Submodule: Tier Economics Builder.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/tier-economics-builder
 */

import type { TierMarginItem } from '@/seed/types/unit-economics-types';
import { calculateGrossMarginPct } from './calculators';

export interface TierCounts {
  BASIC: number;
  PREMIUM: number;
  ENTERPRISE: number;
  MASTER: number;
}

export const TIER_CONFIG_SPECS = [
  {
    tier: 'BASIC' as const,
    monthlyPriceUsd: 199,
    monthlyMcuQuota: 200,
    estimatedVideoQuota: 100,
    status: 'OPTIMAL' as const,
  },
  {
    tier: 'PREMIUM' as const,
    monthlyPriceUsd: 399,
    monthlyMcuQuota: 500,
    estimatedVideoQuota: 250,
    status: 'OPTIMAL' as const,
  },
  {
    tier: 'ENTERPRISE' as const,
    monthlyPriceUsd: 799,
    monthlyMcuQuota: 1200,
    estimatedVideoQuota: 600,
    status: 'HEALTHY' as const,
  },
  {
    tier: 'MASTER' as const,
    monthlyPriceUsd: 4999,
    monthlyMcuQuota: 10000,
    estimatedVideoQuota: 5000,
    status: 'OPTIMAL' as const,
  },
];

/**
 * Builds tier economics items from current tier counts and unit video COGS.
 */
export function buildTierEconomics(
  tierCounts: TierCounts,
  cogsPerVideoUsd: number
): TierMarginItem[] {
  return TIER_CONFIG_SPECS.map((spec) => {
    const activeSubscribers = tierCounts[spec.tier];
    const monthlyRevenueUsd = activeSubscribers * spec.monthlyPriceUsd;
    const estimatedCogsUsd = Number(
      (activeSubscribers * spec.estimatedVideoQuota * cogsPerVideoUsd).toFixed(2)
    );
    const grossMarginPct = calculateGrossMarginPct(monthlyRevenueUsd, estimatedCogsUsd);

    return {
      tier: spec.tier,
      monthlyPriceUsd: spec.monthlyPriceUsd,
      monthlyMcuQuota: spec.monthlyMcuQuota,
      estimatedVideoQuota: spec.estimatedVideoQuota,
      activeSubscribers,
      monthlyRevenueUsd,
      estimatedCogsUsd,
      grossMarginPct,
      status: spec.status,
    };
  });
}
