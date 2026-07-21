/**
 * Unit tests for winner-picker.ts
 *
 * Tests the new statistical significance gate (chi-square, p<0.05, min sample size)
 * and max-window marginal winner logic.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateWinner,
  evaluateBatch,
  computeCtr,
  chiSquareTest,
  MIN_IMPRESSIONS_PER_VARIANT,
  MAX_WINDOW_HOURS,
  SIGNIFICANCE_LEVEL,
  MIN_CTR_DIFF_PCT,
} from '../winner-picker';
import type { AbExperiment } from '../ab-types';

// Test constants
const BASE_EXPERIMENT: AbExperiment = {
  id: 'test-exp-001',
  videoId: 'video-001',
  tenantId: 'tenant-001',
  variantACaption: 'Title A',
  variantBCaption: 'Title B',
  variantAThumbUrl: null,
  variantBThumbUrl: null,
  impressionsA: 0,
  impressionsB: 0,
  conversionsA: 0,
  conversionsB: 0,
  winner: null,
  status: 'active',
  createdAt: new Date().toISOString(),
  decidedAt: null,
  offerId: null,
  bundleId: null,
};

function makeExp(
  overrides: Partial<AbExperiment> & { ageHours?: number }
): AbExperiment {
  const { ageHours, ...rest } = overrides;
  const createdAt = ageHours !== undefined
    ? new Date(Date.now() - ageHours * 60 * 60 * 1000).toISOString()
    : BASE_EXPERIMENT.createdAt;
  return { ...BASE_EXPERIMENT, createdAt, ...rest };
}

// ---------------------------------------------------------------------------
// computeCtr
// ---------------------------------------------------------------------------

describe('computeCtr', () => {
  it('returns 0 when impressions is 0', () => {
    expect(computeCtr(5, 0)).toBe(0);
  });

  it('returns correct ratio', () => {
    expect(computeCtr(10, 100)).toBeCloseTo(0.1);
  });

  it('handles zero conversions', () => {
    expect(computeCtr(0, 100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// chiSquareTest
// ---------------------------------------------------------------------------

describe('chiSquareTest', () => {
  it('returns significant when CTR difference is large with sufficient samples', () => {
    // A: 20/100 = 20%, B: 5/100 = 5% -> large difference
    const result = chiSquareTest(20, 100, 5, 100);
    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it('returns not significant when CTR is similar', () => {
    // A: 10/100 = 10%, B: 9/100 = 9% -> small difference
    const result = chiSquareTest(10, 100, 9, 100);
    expect(result.significant).toBe(false);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it('returns not significant with small sample sizes', () => {
    // Same ratio but too few samples
    const result = chiSquareTest(5, 25, 1, 25);
    expect(result.significant).toBe(false);
  });

  it('handles zero impressions on both sides', () => {
    const result = chiSquareTest(0, 0, 0, 0);
    // With zero total, expected chi2 is 0, p-value is 1
    expect(result.chi2).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateWinner — minimum sample size gate
// ---------------------------------------------------------------------------

describe('evaluateWinner — minimum sample size gate', () => {
  it('returns null when either variant has < MIN_IMPRESSIONS_PER_VARIANT (default 100) and age < MAX_WINDOW_HOURS', () => {
    const exp = makeExp({
      impressionsA: 50,
      impressionsB: 100,
      conversionsA: 10,
      conversionsB: 10,
      ageHours: 10,
    });
    expect(evaluateWinner(exp)).toBeNull();
  });

  it('returns null when both variants have < MIN_IMPRESSIONS_PER_VARIANT', () => {
    const exp = makeExp({
      impressionsA: 50,
      impressionsB: 50,
      conversionsA: 10,
      conversionsB: 5,
      ageHours: 10,
    });
    expect(evaluateWinner(exp)).toBeNull();
  });

  it('returns no_winner when age >= MAX_WINDOW_HOURS but samples < MIN_IMPRESSIONS_PER_VARIANT', () => {
    const exp = makeExp({
      impressionsA: 50,
      impressionsB: 50,
      conversionsA: 10,
      conversionsB: 5,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('no_winner');
  });
});

// ---------------------------------------------------------------------------
// evaluateWinner — statistical significance (p < 0.05)
// ---------------------------------------------------------------------------

describe('evaluateWinner — statistical significance', () => {
  it('declares winner A when p < 0.05 and CTR_A > CTR_B (20% vs 5%)', () => {
    const exp = makeExp({
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 40,
      conversionsB: 10,
      ageHours: 10,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
    expect(result!.ctrA).toBeCloseTo(0.2);
    expect(result!.ctrB).toBeCloseTo(0.05);
  });

  it('declares winner B when p < 0.05 and CTR_B > CTR_A', () => {
    const exp = makeExp({
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 10,
      conversionsB: 40,
      ageHours: 10,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('b');
  });

  it('returns null (pending) when samples >= 100 but p >= 0.05 and age < 48h', () => {
    // 10% vs 9% - not significant with 200 each
    const exp = makeExp({
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 20,
      conversionsB: 18,
      ageHours: 10,
    });
    expect(evaluateWinner(exp)).toBeNull();
  });

  it('handles boundary case: exactly MIN_IMPRESSIONS_PER_VARIANT with large difference', () => {
    // 100 impressions each, 20% vs 5%
    const exp = makeExp({
      impressionsA: MIN_IMPRESSIONS_PER_VARIANT,
      impressionsB: MIN_IMPRESSIONS_PER_VARIANT,
      conversionsA: 20,
      conversionsB: 5,
      ageHours: 10,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// evaluateWinner — max window logic
// ---------------------------------------------------------------------------

describe('evaluateWinner — max window (48h) logic', () => {
  it('returns no_winner when age >= 48h, p >= 0.05, and CTR difference < MIN_CTR_DIFF_PCT (0.5pp)', () => {
    // Need enough samples so p >= 0.05 with small difference small diff. Use 1000 samples each, 100 vs 104 = 10% vs 10.4% = 0.4pp
    const exp = makeExp({
      impressionsA: 1000,
      impressionsB: 1000,
      conversionsA: 100,
      conversionsB: 104,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('no_winner');
  });

  it('returns marginal winner when age >= 48h, p >= 0.05, but CTR diff >= MIN_CTR_DIFF_PCT (0.5pp)', () => {
    // 10.4% vs 10% = 0.4pp diff - too small
    // 10.5% vs 10% = 0.5pp diff - exactly at threshold
    // With 1000 samples: 105 vs 100 conversions
    const exp = makeExp({
      impressionsA: 1000,
      impressionsB: 1000,
      conversionsA: 105,
      conversionsB: 100,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
    expect(result!.reason).toContain('Marginal');
  });

  it('returns winner when age >= 48h AND p < 0.05 (significance takes precedence)', () => {
    // 20% vs 5% - very significant
    const exp = makeExp({
      impressionsA: 400,
      impressionsB: 400,
      conversionsA: 80,
      conversionsB: 20,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
    expect(result!.reason).toContain('p=');
    expect(result!.reason).not.toContain('marginal');
  });

  it('handles tied CTR at max window (no winner)', () => {
    const exp = makeExp({
      impressionsA: 300,
      impressionsB: 300,
      conversionsA: 30,
      conversionsB: 30,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('no_winner');
  });
});

// ---------------------------------------------------------------------------
// evaluateWinner — edge cases
// ---------------------------------------------------------------------------

describe('evaluateWinner — edge cases', () => {
  it('handles zero impressions on one side with sufficient samples on other', () => {
    const exp = makeExp({
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 40,
      conversionsB: 0,
      ageHours: 10,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    // With zero conversions on B, chi-square should be very significant
    expect(result!.winner).toBe('a');
  });

  it('handles all zeros at max window', () => {
    const exp = makeExp({
      impressionsA: 50,
      impressionsB: 50,
      conversionsA: 0,
      conversionsB: 0,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('no_winner');
  });

  it('handles variant with zero impressions at max window', () => {
    const exp = makeExp({
      impressionsA: 200,
      impressionsB: 0,
      conversionsA: 20,
      conversionsB: 0,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    // Should still honor min impressions per variant rule
    expect(result!.winner).toBe('no_winner');
  });
});

// ---------------------------------------------------------------------------
// evaluateBatch
// ---------------------------------------------------------------------------

describe('evaluateBatch', () => {
  it('returns empty array when all experiments are still pending', () => {
    const exp = makeExp({ impressionsA: 0, impressionsB: 0, ageHours: 1 });
    expect(evaluateBatch([exp])).toEqual([]);
  });

  it('returns decisions for experiments that are ready', () => {
    const ready = makeExp({
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 40,
      conversionsB: 10,
      ageHours: 10,
    });
    const pending = makeExp({
      id: 'pending-001',
      impressionsA: 10,
      impressionsB: 10,
      ageHours: 1,
    });
    const results = evaluateBatch([ready, pending]);
    expect(results).toHaveLength(1);
    expect(results[0].winner).toBe('a');
  });

  it('handles mixed batch correctly', () => {
    const expA = makeExp({
      id: 'exp-a',
      impressionsA: 400,
      impressionsB: 400,
      conversionsA: 80,
      conversionsB: 20,
      ageHours: 30,
    });
    const expB = makeExp({
      id: 'exp-b',
      impressionsA: 400,
      impressionsB: 400,
      conversionsA: 20,
      conversionsB: 80,
      ageHours: 30,
    });
    const expPending = makeExp({
      id: 'exp-pending',
      impressionsA: 20,
      impressionsB: 20,
      ageHours: 5,
    });

    const results = evaluateBatch([expA, expB, expPending]);
    expect(results).toHaveLength(2);

    const ids = results.map((r) => r.experimentId);
    expect(ids).toContain('exp-a');
    expect(ids).toContain('exp-b');

    const resultA = results.find((r) => r.experimentId === 'exp-a');
    const resultB = results.find((r) => r.experimentId === 'exp-b');
    expect(resultA!.winner).toBe('a');
    expect(resultB!.winner).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Constants verification
// ---------------------------------------------------------------------------

describe('Constants', () => {
  it('has correct constant values', () => {
    expect(MIN_IMPRESSIONS_PER_VARIANT).toBe(100);
    expect(MAX_WINDOW_HOURS).toBe(48);
    expect(SIGNIFICANCE_LEVEL).toBe(0.05);
    expect(MIN_CTR_DIFF_PCT).toBe(0.5); // 0.5 percentage points
  });
});