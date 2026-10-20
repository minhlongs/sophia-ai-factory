/**
 * Affiliate Rate Resolver Tests
 *
 * Locks the CEO-fixed commission table (BASIC 30% × 12, PREMIUM 25% × 12,
 * ENTERPRISE 20% × 12, MASTER 10% one-time) and the precedence order:
 * operator override > customer tier > partner default.
 *
 * @module affiliates/__tests__/rate-resolver.test
 */

import { describe, it, expect } from 'vitest';
import type { Tier } from '@/seed/types';
import {
  resolveCommissionRate,
  resolveTierRate,
} from '@/land/affiliates/rate-resolver';
import {
  AFFILIATE_RATE_BY_TIER,
  AFFILIATE_RECURRING_MONTHS,
} from '@/seed/config/revenue-share';

const partner = (commissionRatePct: number, customRateOverridePct?: number | null) => ({
  commission_rate_pct: commissionRatePct,
  custom_rate_override_pct: customRateOverridePct ?? null,
});

describe('resolveTierRate — full 4-tier truth table', () => {
  const expected: Array<{ tier: Tier; ratePct: number; recurringMonths: number }> = [
    { tier: 'BASIC', ratePct: 30, recurringMonths: 12 },
    { tier: 'PREMIUM', ratePct: 25, recurringMonths: 12 },
    { tier: 'ENTERPRISE', ratePct: 20, recurringMonths: 12 },
    { tier: 'MASTER', ratePct: 10, recurringMonths: 0 },
  ];

  it.each(expected)('$tier → $ratePct% for $recurringMonths months', ({ tier, ratePct, recurringMonths }) => {
    const result = resolveTierRate(tier);

    expect(result.ratePct).toBe(ratePct);
    expect(result.recurringMonths).toBe(recurringMonths);
    expect(result.customerTier).toBe(tier);
  });

  it('config table matches the resolver for every tier', () => {
    for (const tier of ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as Tier[]) {
      expect(resolveTierRate(tier).ratePct).toBe(AFFILIATE_RATE_BY_TIER[tier]);
    }
  });

  it('MASTER is one-time, every other tier recurs', () => {
    expect(resolveTierRate('MASTER').recurringMonths).toBe(0);
    expect(AFFILIATE_RECURRING_MONTHS).toBe(12);
    for (const tier of ['BASIC', 'PREMIUM', 'ENTERPRISE'] as Tier[]) {
      expect(resolveTierRate(tier).recurringMonths).toBe(AFFILIATE_RECURRING_MONTHS);
    }
  });
});

describe('resolveCommissionRate — precedence', () => {
  it('partner rate follows the referred customer tier, not the partner', () => {
    const enterprise = resolveCommissionRate('ENTERPRISE', partner(20));
    const basic = resolveCommissionRate('BASIC', partner(20));

    expect(basic.ratePct).toBe(30);
    expect(enterprise.ratePct).toBe(20);
    expect(basic.ratePct).toBeGreaterThan(enterprise.ratePct);
  });

  it('custom_rate_override_pct wins over the customer tier', () => {
    const result = resolveCommissionRate('BASIC', partner(20, 55));

    expect(result.ratePct).toBe(55);
    expect(result.recurringMonths).toBe(AFFILIATE_RECURRING_MONTHS);
  });

  it('custom_rate_override_pct wins over MASTER one-time', () => {
    const result = resolveCommissionRate('MASTER', partner(20, 55));

    expect(result.ratePct).toBe(55);
    expect(result.recurringMonths).toBe(AFFILIATE_RECURRING_MONTHS);
  });

  it('a zero override is ignored and the tier rate is used', () => {
    const result = resolveCommissionRate('BASIC', partner(20, 0));

    expect(result.ratePct).toBe(AFFILIATE_RATE_BY_TIER.BASIC);
  });

  it('a null override is ignored and the tier rate is used', () => {
    const result = resolveCommissionRate('ENTERPRISE', partner(20, null));

    expect(result.ratePct).toBe(AFFILIATE_RATE_BY_TIER.ENTERPRISE);
  });

  it('falls back to the partner default when the customer tier is unknown', () => {
    const result = resolveCommissionRate(null, partner(17));

    expect(result.ratePct).toBe(17);
  });

  it('falls back when the customer tier is undefined', () => {
    const result = resolveCommissionRate(undefined, partner(18));

    expect(result.ratePct).toBe(18);
  });

  it('falls back to the aligned default when partner rate is also missing', () => {
    const result = resolveCommissionRate(null, partner(0, null));

    expect(result.ratePct).toBe(20);
  });

  it('never throws for a malformed partner row', () => {
    const malformed = {
      commission_rate_pct: Number.NaN,
      custom_rate_override_pct: undefined,
    };

    expect(() => resolveCommissionRate('BASIC', malformed)).not.toThrow();
    expect(resolveCommissionRate('BASIC', malformed).ratePct).toBe(30);
  });
});
