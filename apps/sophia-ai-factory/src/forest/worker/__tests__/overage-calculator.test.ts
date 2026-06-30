/**
 * Unit tests for overage-calculator
 * @module forest/worker/__tests__/overage-calculator.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOverage,
  calculateUpgradeSavings,
  formatOverageFee,
  getTierPricing,
  OVERAGE_RATES,
} from '../lib/overage-calculator';

describe('getTierPricing', () => {
  it('returns BASIC pricing for null tier', () => {
    const pricing = getTierPricing(null);
    expect(pricing).toEqual(OVERAGE_RATES.BASIC);
  });

  it('returns BASIC pricing for undefined tier', () => {
    const pricing = getTierPricing(undefined);
    expect(pricing).toEqual(OVERAGE_RATES.BASIC);
  });

  it('returns BASIC pricing for unknown tier', () => {
    const pricing = getTierPricing('UNKNOWN');
    expect(pricing).toEqual(OVERAGE_RATES.BASIC);
  });

  it('returns PREMIUM pricing for premium tier', () => {
    const pricing = getTierPricing('PREMIUM');
    expect(pricing).toEqual(OVERAGE_RATES.PREMIUM);
  });

  it('returns ENTERPRISE pricing for enterprise tier', () => {
    const pricing = getTierPricing('ENTERPRISE');
    expect(pricing).toEqual(OVERAGE_RATES.ENTERPRISE);
  });

  it('normalizes case-insensitive tier input', () => {
    const pricing = getTierPricing('premium');
    expect(pricing).toEqual(OVERAGE_RATES.PREMIUM);
  });
});

describe('calculateOverage', () => {
  it('returns zero overage when usage is below limit', () => {
    const result = calculateOverage(500, 'BASIC');
    expect(result.overageCount).toBe(0);
    expect(result.overageFee).toBe(0);
    expect(result.isOverHardLimit).toBe(false);
    expect(result.remaining).toBe(500);
    expect(result.tier).toBe('BASIC');
    expect(result.baseLimit).toBe(1000);
  });

  it('calculates overage when usage exceeds limit', () => {
    const result = calculateOverage(1200, 'BASIC');
    expect(result.overageCount).toBe(200);
    expect(result.overageFee).toBe(10);
    expect(result.isOverHardLimit).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('detects hard limit exceeded', () => {
    const result = calculateOverage(1600, 'BASIC');
    expect(result.overageCount).toBe(600);
    expect(result.overageFee).toBe(30);
    expect(result.isOverHardLimit).toBe(true);
  });

  it('calculates PREMIUM tier overage correctly', () => {
    const result = calculateOverage(12000, 'PREMIUM');
    expect(result.overageCount).toBe(2000);
    expect(result.overageFee).toBe(60);
    expect(result.tier).toBe('PREMIUM');
  });

  it('calculates ENTERPRISE tier overage correctly', () => {
    const result = calculateOverage(110000, 'ENTERPRISE');
    expect(result.overageCount).toBe(10000);
    expect(result.overageFee).toBe(100);
    expect(result.tier).toBe('ENTERPRISE');
  });

  it('returns zero overage for exactly at limit', () => {
    const result = calculateOverage(1000, 'BASIC');
    expect(result.overageCount).toBe(0);
    expect(result.overageFee).toBe(0);
    expect(result.remaining).toBe(0);
  });

  it('rounds overage fee to 2 decimal places', () => {
    const result = calculateOverage(1001, 'BASIC');
    expect(result.overageFee).toBe(0.05);
  });

  it('handles zero usage', () => {
    const result = calculateOverage(0, 'PREMIUM');
    expect(result.overageCount).toBe(0);
    expect(result.overageFee).toBe(0);
    expect(result.remaining).toBe(10000);
  });

  it('handles negative usage as zero overage', () => {
    const result = calculateOverage(-100, 'BASIC');
    expect(result.overageCount).toBe(0);
    expect(result.overageFee).toBe(0);
  });

  it('normalizes tier to uppercase', () => {
    const result = calculateOverage(1100, 'basic');
    expect(result.tier).toBe('BASIC');
  });

  it('defaults null tier to BASIC', () => {
    const result = calculateOverage(1100, null);
    expect(result.tier).toBe('BASIC');
    expect(result.overageFee).toBe(5);
  });
});

describe('calculateUpgradeSavings', () => {
  it('returns savings when upgrading from BASIC to PREMIUM', () => {
    const result = calculateUpgradeSavings(5000, 'BASIC');
    expect(result.currentOverage).toBeGreaterThan(0);
    expect(result.nextTier).toBe('PREMIUM');
    expect(result.savings).toBeGreaterThan(0);
  });

  it('returns null next tier for ENTERPRISE', () => {
    const result = calculateUpgradeSavings(200000, 'ENTERPRISE');
    expect(result.nextTier).toBeNull();
    expect(result.savings).toBe(0);
  });

  it('returns null next tier for unknown current tier', () => {
    const result = calculateUpgradeSavings(1000, 'UNKNOWN');
    expect(result.nextTier).toBeNull();
    expect(result.savings).toBe(0);
  });

  it('shows zero savings when usage is within base limit', () => {
    const result = calculateUpgradeSavings(500, 'BASIC');
    expect(result.currentOverage).toBe(0);
    expect(result.nextTier).toBe('PREMIUM');
    expect(result.savings).toBe(0);
  });
});

describe('formatOverageFee', () => {
  it('formats whole dollars correctly', () => {
    expect(formatOverageFee(10)).toBe('$10.00');
  });

  it('formats cents correctly', () => {
    expect(formatOverageFee(0.50)).toBe('$0.50');
  });

  it('formats zero correctly', () => {
    expect(formatOverageFee(0)).toBe('$0.00');
  });

  it('formats large numbers with commas', () => {
    expect(formatOverageFee(1234.56)).toBe('$1,234.56');
  });
});
