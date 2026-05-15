/**
 * Tests for affiliate quality scoring framework (v2 — anti-scam + EPC).
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
// Core scoring tests (weight-agnostic where possible)
// ---------------------------------------------------------------------------

describe('scoreAffiliate', () => {
  it('high-quality offer passes threshold', () => {
    // 80% commission + $5 EPC + 120d cookie + daily payout + 30mo + 0.9 approval
    const aff = makeAffiliate({ commissionPct: 80, epc: 5 });
    const result = scoreAffiliate(aff, {
      cookieDays: 120,
      payoutFrequency: 'daily',
      programAgeMonths: 30,
      approvalRate: 0.9,
    });

    expect(result.score).toBeGreaterThan(0.75);
    expect(result.passes).toBe(true);
    expect(result.scamDetection.scamRisk).toBeLessThan(0.5);
  });

  it('low-quality offer fails threshold', () => {
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
    const aff = makeAffiliate({ commissionPct: 0, epc: 0 }); // zero commission + epc

    // Give commission+epc weight 0 → score driven by other factors
    const result = scoreAffiliate(aff, {
      weights: { commission: 0, epc: 0, cookieDuration: 0.5, payoutSpeed: 0.5, programAge: 0, approvalRate: 0 },
      cookieDays: 180,       // max cookie → 1.0
      payoutFrequency: 'daily', // max payout → 1.0
      skipScamCheck: true,
    });

    // With cookie=1.0 weight 0.5 + payout=1.0 weight 0.5 → score = 1.0
    expect(result.score).toBeCloseTo(1.0, 2);
  });

  it('custom threshold respected — same score, different passes', () => {
    const aff = makeAffiliate({ commissionPct: 20 });
    const defaultResult = scoreAffiliate(aff); // threshold 0.7
    const lowResult = scoreAffiliate(aff, { threshold: 0.3 });

    // Confirm the scores are the same — threshold only changes `passes`
    expect(defaultResult.score).toBe(lowResult.score);
    expect(lowResult.passes).toBe(true);
  });

  it('unknown fields fall back to defaults — no crash', () => {
    const aff = makeAffiliate(); // no commission, no epc, no ctx
    const result = scoreAffiliate(aff);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(typeof result.passes).toBe('boolean');
    expect(Object.keys(result.breakdown)).toHaveLength(6);
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
    const aff = makeAffiliate({ commissionPct: 150, commissionFlatUsd: 999, epc: 999 });
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

  it('scamDetection is present on result', () => {
    const aff = makeAffiliate({ commissionPct: 50 });
    const result = scoreAffiliate(aff);

    expect(result.scamDetection).toBeDefined();
    expect(typeof result.scamDetection.scamRisk).toBe('number');
    expect(result.scamDetection.breakdown).toBeDefined();
    expect(Array.isArray(result.scamDetection.signals)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EPC factor tests
// ---------------------------------------------------------------------------

describe('scoreAffiliate — EPC factor', () => {
  it('absent EPC yields neutral score (0.5)', () => {
    const aff = makeAffiliate({ commissionPct: 30 });
    const result = scoreAffiliate(aff);
    expect(result.breakdown.epc).toBe(0.5);
  });

  it('$0 EPC yields epc breakdown = 0', () => {
    const aff = makeAffiliate({ commissionPct: 30, epc: 0 });
    const result = scoreAffiliate(aff);
    expect(result.breakdown.epc).toBe(0);
  });

  it('$10 EPC yields epc breakdown = 1.0', () => {
    const aff = makeAffiliate({ commissionPct: 30, epc: 10 });
    const result = scoreAffiliate(aff);
    expect(result.breakdown.epc).toBeCloseTo(1.0, 3);
  });

  it('$5 EPC yields epc breakdown ≈ 0.5', () => {
    const aff = makeAffiliate({ commissionPct: 30, epc: 5 });
    const result = scoreAffiliate(aff);
    expect(result.breakdown.epc).toBeCloseTo(0.5, 3);
  });

  it('$20 EPC is capped at 1.0', () => {
    const aff = makeAffiliate({ commissionPct: 30, epc: 20 });
    const result = scoreAffiliate(aff);
    expect(result.breakdown.epc).toBe(1.0);
  });

  it('high commission but zero EPC scores lower than balanced offer', () => {
    // High commission (80%), explicitly zero EPC (scam pattern: huge promises, no conversions)
    const highCommissionZeroEpc = scoreAffiliate(makeAffiliate({ commissionPct: 80, epc: 0 }), {
      cookieDays: 30,
      payoutFrequency: 'monthly',
      programAgeMonths: 12,
      approvalRate: 0.5,
      skipScamCheck: true,
    });

    // Balanced offer: medium commission + high EPC ($8)
    const balanced = scoreAffiliate(makeAffiliate({ commissionPct: 40, epc: 8 }), {
      cookieDays: 30,
      payoutFrequency: 'monthly',
      programAgeMonths: 12,
      approvalRate: 0.5,
      skipScamCheck: true,
    });

    // Balanced offer with high EPC should score higher than 80% commission + zero EPC
    expect(balanced.score).toBeGreaterThan(highCommissionZeroEpc.score);
  });
});

// ---------------------------------------------------------------------------
// Scam gate tests
// ---------------------------------------------------------------------------

describe('scoreAffiliate — scam gate', () => {
  it('known scam domain auto-fails regardless of quality score', () => {
    // High commission but known scam domain
    const aff = makeAffiliate({
      commissionPct: 100,
      epc: 10,
      productUrl: 'https://free-money-now.com/program',
    });
    const result = scoreAffiliate(aff, {
      cookieDays: 180,
      payoutFrequency: 'daily',
      programAgeMonths: 36,
      approvalRate: 0.95,
    });

    expect(result.passes).toBe(false);
    expect(result.scamDetection.scamRisk).toBeGreaterThanOrEqual(0.5);
  });

  it('skipScamCheck bypasses scam gate', () => {
    const aff = makeAffiliate({
      commissionPct: 80,
      epc: 8,
      productUrl: 'https://free-money-now.com/program', // normally would fail
    });
    const result = scoreAffiliate(aff, {
      cookieDays: 180,
      payoutFrequency: 'daily',
      programAgeMonths: 36,
      approvalRate: 0.95,
      skipScamCheck: true,
    });

    // With scam check skipped and very high quality score, should pass
    expect(result.scamDetection.scamRisk).toBe(0);
    // Score-based pass only depends on threshold
    expect(result.passes).toBe(result.score >= 0.7);
  });

  it('MLM-heavy description fails scam gate with multi-signal', () => {
    const aff = makeAffiliate({
      commissionPct: 50,
      productName: 'Ponzi Pay — guaranteed roi double your money',
      productUrl: 'https://ponzi-pay.com/join',
      description: 'Network marketing matrix plan recruit members downline upline automated money machine',
    });
    const result = scoreAffiliate(aff, {
      cookieDays: 90,
      payoutFrequency: 'weekly',
      programAgeMonths: 12,
      approvalRate: 0.7,
    });

    expect(result.passes).toBe(false);
    expect(result.scamDetection.scamRisk).toBeGreaterThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// Crypto volume tests
// ---------------------------------------------------------------------------

describe('scoreAffiliate — crypto volume', () => {
  it('crypto offer with >$1M volume gets no penalty', () => {
    // High-quality offer + volume well above $1M — should pass
    const aff = makeAffiliate({
      commissionPct: 60,
      epc: 8,
      cryptoVolumeUsd: 10_000_000,
    });
    const result = scoreAffiliate(aff, {
      cookieDays: 180,
      payoutFrequency: 'daily',
      programAgeMonths: 36,
      approvalRate: 0.9,
      skipScamCheck: true,
    });

    // No volume cap applied — score follows normal scoring
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('crypto offer with <$1M volume gets capped at 0.8', () => {
    // Even with perfect scores in all factors, low-volume crypto caps at 0.8
    const aff = makeAffiliate({
      commissionPct: 100,
      epc: 10,
      cryptoVolumeUsd: 100_000, // below $1M threshold — cap applies
    });
    const result = scoreAffiliate(aff, {
      cookieDays: 180,
      payoutFrequency: 'daily',
      programAgeMonths: 36,
      approvalRate: 1.0,
      skipScamCheck: true,
    });

    // Cap at 0.8 applied because cryptoVolumeUsd < 1M
    expect(result.score).toBeLessThanOrEqual(0.801); // allow for rounding
  });

  it('non-crypto offer (no cryptoVolumeUsd) has no volume penalty', () => {
    // Good offer with no crypto volume field — no cap applied
    const aff = makeAffiliate({
      commissionPct: 60,
      epc: 8,
      // no cryptoVolumeUsd
    });
    const result = scoreAffiliate(aff, {
      cookieDays: 180,
      payoutFrequency: 'daily',
      programAgeMonths: 36,
      approvalRate: 0.9,
      skipScamCheck: true,
    });

    // No crypto volume cap — score unrestricted
    expect(result.score).toBeGreaterThan(0.7);
  });
});
