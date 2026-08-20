/**
 * Tests for winner-picker pure functions — Phase 4: Creative Learning Loop
 *
 * Covers:
 *   1. computeCtr — zero impressions → 0, normal CTR, edge cases
 *   2. chiSquareTest — no data → p=1; significant difference; no difference; equal samples
 *   3. evaluateWinner — insufficient impressions, significant winner, max window, no_winner
 *   4. evaluateBatch — filters nulls, returns only decisions
 *
 * Note: The ab-winner-picker-cron Inngest function itself is not testable
 * without a live Inngest client + D1. These tests cover the core statistical
 * logic it delegates to.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  computeCtr,
  chiSquareTest,
  evaluateWinner,
  evaluateBatch,
  MIN_IMPRESSIONS_PER_VARIANT,
  MAX_WINDOW_HOURS,
  SIGNIFICANCE_LEVEL,
  MIN_CTR_DIFF_PCT,
} from '../winner-picker';
import type { AbExperiment, WinnerEvaluation } from '../ab-types';

// ─── Constants ──────────────────────────────────────────────────────────────

describe('winner-picker constants', () => {
  it('MIN_IMPRESSIONS_PER_VARIANT is 100', () => {
    expect(MIN_IMPRESSIONS_PER_VARIANT).toBe(100);
  });

  it('MAX_WINDOW_HOURS is 48', () => {
    expect(MAX_WINDOW_HOURS).toBe(48);
  });

  it('SIGNIFICANCE_LEVEL is 0.05', () => {
    expect(SIGNIFICANCE_LEVEL).toBe(0.05);
  });

  it('MIN_CTR_DIFF_PCT is 0.5', () => {
    expect(MIN_CTR_DIFF_PCT).toBe(0.5);
  });
});

// ─── computeCtr ─────────────────────────────────────────────────────────────

describe('computeCtr', () => {
  it('returns 0 when impressions is 0', () => {
    expect(computeCtr(5, 0)).toBe(0);
  });

  it('returns correct CTR for normal case', () => {
    expect(computeCtr(10, 100)).toBe(0.1);
  });

  it('returns 0 when no conversions', () => {
    expect(computeCtr(0, 100)).toBe(0);
  });

  it('returns 1.0 when all impressions convert', () => {
    expect(computeCtr(50, 50)).toBe(1);
  });

  it('handles very small fractional CTR', () => {
    expect(computeCtr(1, 1000)).toBeCloseTo(0.001, 6);
  });
});

// ─── chiSquareTest ──────────────────────────────────────────────────────────

describe('chiSquareTest', () => {
  it('returns chi2=0, p=1, not significant for zero total', () => {
    const result = chiSquareTest(0, 0, 0, 0);
    expect(result.chi2).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
  });

  it('returns not significant for identical variant data', () => {
    const result = chiSquareTest(50, 1000, 50, 1000);
    expect(result.significant).toBe(false);
    expect(result.chi2).toBeCloseTo(0, 6);
  });

  it('returns significant for large difference in conversion rates', () => {
    // 100/1000 = 10% vs 20/1000 = 2% — a big difference
    const result = chiSquareTest(100, 1000, 20, 1000);
    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(SIGNIFICANCE_LEVEL);
    expect(result.chi2).toBeGreaterThan(0);
  });

  it('returns not significant for small difference with low sample', () => {
    // 3/100 = 3% vs 5/100 = 5% — small, low sample
    const result = chiSquareTest(3, 100, 5, 100);
    expect(result.significant).toBe(false);
  });

  it('returns significant for moderate difference with large sample', () => {
    // 600/10000 = 6% vs 400/10000 = 4% — 2pp difference with N=20000 → chi2≈42, p<0.001
    const result = chiSquareTest(600, 10000, 400, 10000);
    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(SIGNIFICANCE_LEVEL);
    expect(result.chi2).toBeGreaterThan(0);
  });
});

// ─── evaluateWinner ─────────────────────────────────────────────────────────

function makeExperiment(
  overrides: Partial<AbExperiment> = {},
  createdAtMs?: number,
): AbExperiment {
  // Default: experiment created 25 hours ago (within MAX_WINDOW_HOURS)
  const createdMs = createdAtMs ?? Date.now() - 25 * 60 * 60 * 1000;
  return {
    id: 'exp-test',
    videoId: 'vid-1',
    contentType: 'caption',
    tenantId: 'ws-1',
    variantACaption: 'caption A',
    variantBCaption: 'caption B',
    variantAThumbUrl: null,
    variantBThumbUrl: null,
    impressionsA: 200,
    impressionsB: 200,
    conversionsA: 20,
    conversionsB: 10,
    winner: null,
    status: 'active',
    createdAt: new Date(createdMs).toISOString(),
    decidedAt: null,
    offerId: null,
    bundleId: null,
    ...overrides,
  };
}

describe('evaluateWinner', () => {
  it('returns null when variant A impressions below threshold (and within window)', () => {
    // 50 < 100, and only 25h old (within window)
    const exp = makeExperiment({ impressionsA: 50, impressionsB: 500 });
    const result = evaluateWinner(exp);
    // Within window → null (pending)
    expect(result).toBeNull();
  });

  it('returns no_winner when both variants below threshold and past max window', () => {
    // Created 50 hours ago (> MAX_WINDOW_HOURS)
    const createdMs = Date.now() - 50 * 60 * 60 * 1000;
    const exp = makeExperiment({ impressionsA: 30, impressionsB: 40 }, createdMs);
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('no_winner');
  });

  it('returns a winner when statistically significant and enough impressions', () => {
    // 200/2000 = 10% vs 50/2000 = 2.5% — clearly significant with large N
    const exp = makeExperiment({
      impressionsA: 2000,
      impressionsB: 2000,
      conversionsA: 200,
      conversionsB: 50,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
    expect(result!.experimentId).toBe('exp-test');
    expect(result!.ctrA).toBeCloseTo(0.1, 4);
    expect(result!.ctrB).toBeCloseTo(0.025, 4);
  });

  it('returns no_winner at max window when CTR difference is below threshold', () => {
    // Created 50h ago, similar CTRs (5% vs 5.2%) — tiny difference
    const createdMs = Date.now() - 50 * 60 * 60 * 1000;
    const exp = makeExperiment(
      {
        impressionsA: 1000,
        impressionsB: 1000,
        conversionsA: 50,
        conversionsB: 52,
      },
      createdMs,
    );
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    // 52/1000 = 5.2% vs 50/1000 = 5.0% — diff = 0.2pp < 0.5pp threshold
    expect(result!.winner).toBe('no_winner');
  });

  it('returns marginal winner at max window when CTR difference is above threshold', () => {
    // Created 50h ago, CTR diff: 10% vs 5% = 5pp > 0.5pp threshold
    const createdMs = Date.now() - 50 * 60 * 60 * 1000;
    const exp = makeExperiment(
      {
        impressionsA: 1000,
        impressionsB: 1000,
        conversionsA: 100,
        conversionsB: 50,
      },
      createdMs,
    );
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
  });

  it('returns null when within window and not yet significant', () => {
    // Created 10h ago, similar rates
    const createdMs = Date.now() - 10 * 60 * 60 * 1000;
    const exp = makeExperiment(
      {
        impressionsA: 200,
        impressionsB: 200,
        conversionsA: 10,
        conversionsB: 12,
      },
      createdMs,
    );
    const result = evaluateWinner(exp);
    expect(result).toBeNull();
  });
});

// ─── evaluateBatch ──────────────────────────────────────────────────────────

describe('evaluateBatch', () => {
  it('returns empty array for empty input', () => {
    expect(evaluateBatch([])).toEqual([]);
  });

  it('filters out pending experiments (returns only decisions)', () => {
    const createdMs = Date.now() - 5 * 60 * 60 * 1000; // 5h ago — within window
    const pending = makeExperiment(
      { impressionsA: 100, impressionsB: 100, conversionsA: 5, conversionsB: 5 },
      createdMs,
    );
    const result = evaluateBatch([pending]);
    expect(result).toEqual([]);
  });

  it('returns decisions for experiments with clear winners', () => {
    const exp1 = makeExperiment({
      id: 'exp-1',
      impressionsA: 5000,
      impressionsB: 5000,
      conversionsA: 500,
      conversionsB: 100,
    });
    const exp2 = makeExperiment({
      id: 'exp-2',
      impressionsA: 5000,
      impressionsB: 5000,
      conversionsA: 100,
      conversionsB: 500,
    });
    const result = evaluateBatch([exp1, exp2]);
    expect(result.length).toBe(2);
    expect(result[0].winner).toBe('a');
    expect(result[1].winner).toBe('b');
  });

  it('returns only experiments with decisions when mixed with pending', () => {
    const createdMs = Date.now() - 5 * 60 * 60 * 1000;
    const pending = makeExperiment(
      { id: 'exp-pending', impressionsA: 50, impressionsB: 50, conversionsA: 5, conversionsB: 5 },
      createdMs,
    );
    const decided = makeExperiment({
      id: 'exp-decided',
      impressionsA: 5000,
      impressionsB: 5000,
      conversionsA: 500,
      conversionsB: 100,
    });
    const result = evaluateBatch([pending, decided]);
    expect(result.length).toBe(1);
    expect(result[0].experimentId).toBe('exp-decided');
    expect(result[0].winner).toBe('a');
  });
});
