/**
 * Unit tests for dynamic pricing engine
 * @module land/billing/__tests__/dynamic-pricing.test
 */

import { describe, it, expect } from 'vitest';
import {
  getDynamicMultiplier,
  DYNAMIC_PRICING_CONFIG,
  VOLUME_DISCOUNT_TIERS,
} from '../dynamic-pricing-config';
import {
  calculateDynamicPrice,
  estimateMonthlyCost,
} from '../dynamic-pricing';
import { VIDEO_MCU_COSTS } from '../video-mcu-cost-config';

describe('dynamic-pricing-config', () => {
  describe('DYNAMIC_PRICING_CONFIG', () => {
    it('defines multipliers for all tiers', () => {
      expect(DYNAMIC_PRICING_CONFIG.BASIC).toBe(1.0);
      expect(DYNAMIC_PRICING_CONFIG.PREMIUM).toBe(0.95);
      expect(DYNAMIC_PRICING_CONFIG.ENTERPRISE).toBe(0.85);
      expect(DYNAMIC_PRICING_CONFIG.MASTER).toBe(0.75);
    });

    it('BASIC has no discount (1.0)', () => {
      expect(DYNAMIC_PRICING_CONFIG.BASIC).toBe(1.0);
    });
  });

  describe('VOLUME_DISCOUNT_TIERS', () => {
    it('defines three brackets', () => {
      expect(VOLUME_DISCOUNT_TIERS).toHaveLength(3);
    });

    it('first bracket covers 0-100 at full price', () => {
      expect(VOLUME_DISCOUNT_TIERS[0]).toEqual({
        minUnits: 0,
        maxUnits: 100,
        multiplier: 1.0,
      });
    });
  });

  describe('getDynamicMultiplier', () => {
    it('returns 1.0 for BASIC tier with low volume (no discount)', () => {
      expect(getDynamicMultiplier('BASIC', 50)).toBe(1.0);
    });

    it('applies volume discount for PREMIUM tier at 500 units', () => {
      // PREMIUM (0.95) x volume 101-1000 (0.9) = 0.855
      expect(getDynamicMultiplier('PREMIUM', 500)).toBe(0.855);
    });

    it('applies maximum volume discount for high usage', () => {
      // ENTERPRISE (0.85) x volume 1000+ (0.8) = 0.68
      expect(getDynamicMultiplier('ENTERPRISE', 2000)).toBe(0.68);
    });

    it('returns 1.0 for unknown tier', () => {
      expect(getDynamicMultiplier('UNKNOWN_TIER', 100)).toBe(1.0);
    });

    it('handles zero units', () => {
      expect(getDynamicMultiplier('PREMIUM', 0)).toBe(0.95);
    });

    it('floors at 0.5 for extreme discount cases', () => {
      // The floor ensures no multiplier goes below 0.5
      const result = getDynamicMultiplier('MASTER', 5000);
      expect(result).toBeGreaterThanOrEqual(0.5);
    });
  });
});

describe('calculateDynamicPrice', () => {
  it('applies tier discount to base cost', () => {
    const result = calculateDynamicPrice({
      baseCostCents: 1000,
      tier: 'PREMIUM',
      unitsThisMonth: 50,
    });

    // PREMIUM (0.95) x volume 0-100 (1.0) = 0.95
    expect(result.multiplier).toBe(0.95);
    expect(result.adjustedCostCents).toBe(950);
    expect(result.breakdown.tierDiscount).toBe(0.95);
    expect(result.breakdown.volumeDiscount).toBe(1.0);
  });

  it('applies combined tier + volume discount', () => {
    const result = calculateDynamicPrice({
      baseCostCents: 1000,
      tier: 'PREMIUM',
      unitsThisMonth: 500,
    });

    // PREMIUM (0.95) x volume 101-1000 (0.9) = 0.855
    expect(result.multiplier).toBe(0.855);
    expect(result.adjustedCostCents).toBe(855);
  });

  it('returns unadjusted cost for BASIC tier with low volume', () => {
    const result = calculateDynamicPrice({
      baseCostCents: 2000,
      tier: 'BASIC',
      unitsThisMonth: 10,
    });

    expect(result.multiplier).toBe(1.0);
    expect(result.adjustedCostCents).toBe(2000);
    expect(result.breakdown.tierDiscount).toBe(1.0);
    expect(result.breakdown.volumeDiscount).toBe(1.0);
  });

  it('returns 0 for negative base cost', () => {
    const result = calculateDynamicPrice({
      baseCostCents: -500,
      tier: 'ENTERPRISE',
      unitsThisMonth: 100,
    });

    expect(result.adjustedCostCents).toBe(0);
  });

  it('handles zero base cost', () => {
    const result = calculateDynamicPrice({
      baseCostCents: 0,
      tier: 'MASTER',
      unitsThisMonth: 500,
    });

    expect(result.adjustedCostCents).toBe(0);
  });

  it('accepts optional channel parameter without error', () => {
    const result = calculateDynamicPrice({
      baseCostCents: 100,
      tier: 'BASIC',
      unitsThisMonth: 5,
      channel: 'telegram',
    });

    expect(result.adjustedCostCents).toBe(100);
  });
});

describe('estimateMonthlyCost', () => {
  it('returns correct shape with all required fields', () => {
    const result = estimateMonthlyCost({
      estimatedUnits: 100,
      tier: 'BASIC',
    });

    expect(result).toHaveProperty('estimatedCostCents');
    expect(result).toHaveProperty('estimatedUnits');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('tierMultiplier');
    expect(typeof result.estimatedCostCents).toBe('number');
    expect(typeof result.estimatedUnits).toBe('number');
  });

  it('uses VIDEO_CREATE cost as base for projection', () => {
    const result = estimateMonthlyCost({
      estimatedUnits: 10,
      tier: 'BASIC',
    });

    // BASIC (1.0) x 10 units x VIDEO_CREATE (50) = 500
    expect(result.estimatedCostCents).toBe(500);
    expect(result.tierMultiplier).toBe(1.0);
  });

  it('applies tier discount in projection', () => {
    const result = estimateMonthlyCost({
      estimatedUnits: 10,
      tier: 'MASTER',
    });

    // MASTER (0.75) x 10 units x VIDEO_CREATE (50) = 375
    expect(result.estimatedCostCents).toBe(375);
    expect(result.tierMultiplier).toBe(0.75);
  });

  it('handles zero estimated units', () => {
    const result = estimateMonthlyCost({
      estimatedUnits: 0,
      tier: 'PREMIUM',
    });

    expect(result.estimatedCostCents).toBe(0);
    expect(result.estimatedUnits).toBe(0);
  });

  it('handles negative estimated units as zero', () => {
    const result = estimateMonthlyCost({
      estimatedUnits: -50,
      tier: 'ENTERPRISE',
    });

    expect(result.estimatedCostCents).toBe(0);
    expect(result.estimatedUnits).toBe(0);
  });
});
