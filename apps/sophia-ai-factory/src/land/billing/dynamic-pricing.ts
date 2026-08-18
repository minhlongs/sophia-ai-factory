/**
 * Dynamic Pricing Engine
 * Applies tier + volume discounts on top of the static cost engine.
 * Pure functions — no side effects, no database calls.
 * @module billing/dynamic-pricing
 */

import {
  getDynamicMultiplier,
  DYNAMIC_PRICING_CONFIG,
  DEFAULT_TIER_MULTIPLIER,
} from './dynamic-pricing-config';
import { VIDEO_MCU_COSTS } from './video-mcu-cost-config';

export interface PriceBreakdown {
  tierDiscount: number;
  volumeDiscount: number;
}
export interface DynamicPriceResult {
  adjustedCostCents: number;
  multiplier: number;
  breakdown: PriceBreakdown;
}
export interface MonthlyCostEstimate {
  estimatedCostCents: number;
  estimatedUnits: number;
  tier: string;
  tierMultiplier: number;
}
export interface CalculateDynamicPriceOpts {
  baseCostCents: number;
  tier: string;
  unitsThisMonth: number;
  channel?: string;
}
export interface EstimateMonthlyCostOpts {
  estimatedUnits: number;
  tier: string;
}

/** Resolve volume multiplier for breakdown display (mirrors config brackets) */
function resolveVolumeMultiplier(units: number): number {
  if (units > 1000) return 0.8;
  if (units > 100) return 0.9;
  return 1.0;
}

/**
 * Applies dynamic pricing to a base cost.
 * @returns Adjusted cost with multiplier and breakdown
 */
export function calculateDynamicPrice(
  opts: CalculateDynamicPriceOpts,
): DynamicPriceResult {
  const { baseCostCents, tier, unitsThisMonth } = opts;
  if (baseCostCents < 0) {
    return {
      adjustedCostCents: 0,
      multiplier: 1.0,
      breakdown: { tierDiscount: 1.0, volumeDiscount: 1.0 },
    };
  }
  const tierMultiplier = DYNAMIC_PRICING_CONFIG[tier] ?? DEFAULT_TIER_MULTIPLIER;
  const safeUnits = Math.max(0, unitsThisMonth);
  const volumeMultiplier = resolveVolumeMultiplier(safeUnits);
  const combined = getDynamicMultiplier(tier, unitsThisMonth);
  return {
    adjustedCostCents: Math.max(0, Math.round(baseCostCents * combined)),
    multiplier: combined,
    breakdown: { tierDiscount: tierMultiplier, volumeDiscount: volumeMultiplier },
  };
}

/**
 * Projects monthly cost using tier multiplier over VIDEO_CREATE base cost.
 * @returns Estimated total cost and tier multiplier
 */
export function estimateMonthlyCost(
  opts: EstimateMonthlyCostOpts,
): MonthlyCostEstimate {
  const { estimatedUnits, tier } = opts;
  const safeUnits = Math.max(0, estimatedUnits);
  const tierMultiplier = DYNAMIC_PRICING_CONFIG[tier] ?? DEFAULT_TIER_MULTIPLIER;
  return {
    estimatedCostCents: Math.round(safeUnits * VIDEO_MCU_COSTS.VIDEO_CREATE * tierMultiplier),
    estimatedUnits: safeUnits,
    tier,
    tierMultiplier,
  };
}
