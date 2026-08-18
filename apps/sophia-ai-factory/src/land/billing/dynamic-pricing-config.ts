/**
 * Dynamic Pricing Configuration
 *
 * Tier-specific multipliers and volume discount brackets.
 * Pure config — no side effects, no external imports.
 *
 * @module billing/dynamic-pricing-config
 */

/** Per-tier pricing multiplier (1.0 = no discount, <1.0 = cheaper) */
export interface DynamicPricingConfig {
  readonly [key: string]: number;
}

/** Volume discount bracket definition */
export interface VolumeDiscountTier {
  readonly minUnits: number;
  readonly maxUnits: number;
  readonly multiplier: number;
}

/** Tier multipliers — BASIC has no discount; higher tiers pay less per unit */
export const DYNAMIC_PRICING_CONFIG: DynamicPricingConfig = {
  BASIC: 1.0,
  PREMIUM: 0.95,
  ENTERPRISE: 0.85,
  MASTER: 0.75,
} as const;

/** Volume discount brackets — more units consumed → deeper discount */
export const VOLUME_DISCOUNT_TIERS: readonly VolumeDiscountTier[] = [
  { minUnits: 0, maxUnits: 100, multiplier: 1.0 },
  { minUnits: 101, maxUnits: 1000, multiplier: 0.9 },
  { minUnits: 1001, maxUnits: Infinity, multiplier: 0.8 },
] as const;

/** Default multiplier when tier is unknown or unmapped */
export const DEFAULT_TIER_MULTIPLIER = 1.0;

/**
 * Returns the combined tier + volume multiplier for a given tier and usage level.
 *
 * The tier multiplier and volume multiplier are multiplied together:
 *   combined = tierMultiplier * volumeMultiplier
 *
 * @param tier - The user's subscription tier (BASIC | PREMIUM | ENTERPRISE | MASTER)
 * @param unitsThisMonth - Number of units consumed this billing period
 * @returns Combined multiplier (never below 0.5 to prevent extreme discounts)
 */
export function getDynamicMultiplier(tier: string, unitsThisMonth: number): number {
  const tierMultiplier =
    DYNAMIC_PRICING_CONFIG[tier] ?? DEFAULT_TIER_MULTIPLIER;

  const safeUnits = Math.max(0, unitsThisMonth);
  let volumeMultiplier = 1.0;

  for (const bracket of VOLUME_DISCOUNT_TIERS) {
    if (safeUnits >= bracket.minUnits && safeUnits <= bracket.maxUnits) {
      volumeMultiplier = bracket.multiplier;
      break;
    }
  }

  const combined = tierMultiplier * volumeMultiplier;

  // Floor at 0.5 — prevent extreme discounting
  return Math.max(0.5, Math.round(combined * 1000) / 1000);
}
