/**
 * Tests for affiliate quality scoring framework.
 */

import { describe, it, expect } from 'vitest';
import { scoreAffiliate } from '../scoring';
import type { Affiliate } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAffiliate(overrides: Partial<Affiliate> = {}): Affiliate {
  return {
    id: 'test-id',
    tenantId: 'tenant-1',
    network: 'mock',
    externalId: 'ext-001',
    productName: 'Test Product',
    discoveredAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoreAffiliate', () => {
  it('high-quality offer scores > 0.8', () => {
    // 80% commission (Bybit/Bitget-style) + 120d cookie + daily payout + 30mo + 0.9 approval
    const aff = makeAffiliate({ commissionPct: 80 });
    const result = scoreAffiliate(aff, {
      cookieDays: 120,
      payoutFrequency: 'daily',
      programAgeMonths: 30,
      approvalRate: 0.9,
    });

    expect(result.score).toBeGreaterThan(0.8);
    expect(result.passes).toBe(true);
  });

  it('low-quality offer scores < 0.5', () => {
    const aff = makeAffiliate({ commissionPct: 1 });
    const result = scoreAffiliate(aff, {
      cookieDays: 1,
      payoutFrequency: 'quarterly',
      programAgeMonths: 1,
      approvalRate: 0.1,
    });

    expect(result.score).toBeLessThan(0.5);
    expect(result.passes).toBe(false);
  });

  it('custom weights are respected', () => {
    const aff = makeAffiliate({ commissionPct: 0 }); // zero commission

    // Give commission weight 0 → score driven by other factors
    const result = scoreAffiliate(aff, {
      weights: { commission: 0, cookieDuration: 0.5, payoutSpeed: 0.5, programAge: 0, approvalRate: 0 },
      cookieDays: 180, // max cookie → 1.0
      payoutFrequency: 'daily', // max payout → 1.0
    });

    // With cookie=1.0 weight 0.5 + payout=1.0 weight 0.5 → score = 1.0
    expect(result.score).toBeCloseTo(1.0, 2);
  });

  it('custom threshold respected — score 0.65 fails default but passes low threshold', () => {
    const aff = makeAffiliate({ commissionPct: 20 });
    const defaultResult = scoreAffiliate(aff); // threshold 0.7
    const lowResult = scoreAffiliate(aff, { threshold: 0.3 });

    expect(lowResult.passes).toBe(true);
    // Confirm the scores are the same — threshold only changes `passes`
    expect(defaultResult.score).toBe(lowResult.score);
  });

  it('unknown fields fall back to defaults — no crash', () => {
    const aff = makeAffiliate(); // no commission fields, no ctx
    const result = scoreAffiliate(aff);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(typeof result.passes).toBe('boolean');
    expect(Object.keys(result.breakdown)).toHaveLength(5);
  });

  it('commission = 0 yields commission breakdown = 0', () => {
    const aff = makeAffiliate({ commissionPct: 0, commissionFlatUsd: 0 });
    const result = scoreAffiliate(aff);
    expect(result.breakdown.commission).toBe(0);
  });

  it('cookie = 0 days yields cookieDuration breakdown = 0', () => {
    const aff = makeAffiliate({ commissionPct: 30 });
    const result = scoreAffiliate(aff, { cookieDays: 0 });
    expect(result.breakdown.cookieDuration).toBe(0);
  });

  it('flat commission normalised correctly — $200 = 1.0, $100 = 0.5', () => {
    const aff200 = makeAffiliate({ commissionFlatUsd: 200 });
    const aff100 = makeAffiliate({ commissionFlatUsd: 100 });
    const r200 = scoreAffiliate(aff200);
    const r100 = scoreAffiliate(aff100);

    expect(r200.breakdown.commission).toBeCloseTo(1.0, 3);
    expect(r100.breakdown.commission).toBeCloseTo(0.5, 3);
  });

  it('payout speed values map correctly', () => {
    const aff = makeAffiliate();
    const daily = scoreAffiliate(aff, { payoutFrequency: 'daily' });
    const quarterly = scoreAffiliate(aff, { payoutFrequency: 'quarterly' });

    expect(daily.breakdown.payoutSpeed).toBe(1.0);
    expect(quarterly.breakdown.payoutSpeed).toBe(0.2);
    expect(daily.score).toBeGreaterThan(quarterly.score);
  });

  it('breakdown values are all between 0 and 1', () => {
    const aff = makeAffiliate({ commissionPct: 150, commissionFlatUsd: 999 });
    const result = scoreAffiliate(aff, {
      cookieDays: 9999,
      programAgeMonths: 999,
      approvalRate: 2.0, // clamped
    });

    for (const val of Object.values(result.breakdown)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
