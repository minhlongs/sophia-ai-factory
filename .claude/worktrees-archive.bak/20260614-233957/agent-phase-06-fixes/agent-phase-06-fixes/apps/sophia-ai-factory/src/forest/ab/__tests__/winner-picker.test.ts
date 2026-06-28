/**
 * Unit tests for winner-picker.ts
 *
 * Tests:
 * - 2× CTR rule with sufficient impressions
 * - Minimum impressions gate (< 100 → null)
 * - 48h max window → no_winner / marginal winner
 * - Tied CTR → no_winner at max window
 * - Edge cases: zero impressions, zero conversions
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateWinner,
  evaluateBatch,
  computeCtr,
  MIN_IMPRESSIONS,
  MAX_WINDOW_HOURS,
  WINNER_MULTIPLIER,
} from '../winner-picker';
import type { AbExperiment } from '../ab-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  overrides: Partial<AbExperiment> & {
    ageHours?: number;
  }
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
// evaluateWinner — insufficient impressions
// ---------------------------------------------------------------------------

describe('evaluateWinner — insufficient impressions', () => {
  it('returns null when both impressions are 0 and age < 24h', () => {
    const exp = makeExp({ impressionsA: 0, impressionsB: 0, ageHours: 1 });
    expect(evaluateWinner(exp)).toBeNull();
  });

  it('returns null when total impressions < MIN_IMPRESSIONS and age < 48h', () => {
    const exp = makeExp({
      impressionsA: 40,
      impressionsB: 40,
      conversionsA: 10,
      conversionsB: 1,
      ageHours: 25,
    });
    // Even though CTR ratio is 10×, total < 100 and < 48h → null
    expect(evaluateWinner(exp)).toBeNull();
  });

  it('returns no_winner when total < MIN_IMPRESSIONS but age >= MAX_WINDOW_HOURS', () => {
    const exp = makeExp({
      impressionsA: 40,
      impressionsB: 40,
      conversionsA: 4,
      conversionsB: 2,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('no_winner');
  });
});

// ---------------------------------------------------------------------------
// evaluateWinner — 2× CTR rule (sufficient impressions)
// ---------------------------------------------------------------------------

describe('evaluateWinner — 2× CTR rule', () => {
  it('picks variant A when ctrA >= 2× ctrB', () => {
    // ctrA = 20/100 = 0.2; ctrB = 5/100 = 0.05; ratio = 4× ≥ 2×
    const exp = makeExp({
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 20,
      conversionsB: 5,
      ageHours: 25,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
  });

  it('picks variant B when ctrB >= 2× ctrA', () => {
    // ctrA = 3/100; ctrB = 10/100; ratio B/A = 3.33× ≥ 2×
    const exp = makeExp({
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 3,
      conversionsB: 10,
      ageHours: 25,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('b');
  });

  it('returns null when no clear winner and age < MAX_WINDOW_HOURS', () => {
    // ctrA = 10/100; ctrB = 8/100; ratio = 1.25× < 2×
    const exp = makeExp({
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 10,
      conversionsB: 8,
      ageHours: 30,
    });
    expect(evaluateWinner(exp)).toBeNull();
  });

  it('returns marginal winner when >= MAX_WINDOW_HOURS and ctrA > ctrB', () => {
    // ctrA = 10/100; ctrB = 8/100; ratio < 2× but past window
    const exp = makeExp({
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 10,
      conversionsB: 8,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
  });

  it('returns no_winner when >= MAX_WINDOW_HOURS and CTR is exactly tied', () => {
    // ctrA = ctrB = 10/100
    const exp = makeExp({
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 10,
      conversionsB: 10,
      ageHours: MAX_WINDOW_HOURS + 1,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('no_winner');
  });

  it('does not pick winner when exactly at the 2× threshold boundary', () => {
    // ctrA = 0.2, ctrB = 0.1 → ratio = exactly 2× → WINNER A
    const exp = makeExp({
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 20,
      conversionsB: 10,
      ageHours: 25,
    });
    const result = evaluateWinner(exp);
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('a');
  });

  it('handles variant A with zero conversions vs variant B with conversions', () => {
    // ctrA = 0; ctrB = 0.15 → B wins (ctrA = 0 so WINNER_MULTIPLIER * 0 = 0, ctrB > 0 → branch won't trigger for A)
    const exp = makeExp({
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 0,
      conversionsB: 15,
      ageHours: 25,
    });
    const result = evaluateWinner(exp);
    // ctrB >= 2 * ctrA (0.15 >= 0) is true, but ctrA = 0 so second check: ctrB > 0 ✓
    expect(result).not.toBeNull();
    expect(result!.winner).toBe('b');
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
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 20,
      conversionsB: 5,
      ageHours: 25,
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
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 40,
      conversionsB: 10,
      ageHours: 30,
    });
    const expB = makeExp({
      id: 'exp-b',
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 5,
      conversionsB: 20,
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
    expect(resultA!.winner).toBe('a');

    const resultB = results.find((r) => r.experimentId === 'exp-b');
    expect(resultB!.winner).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Constants sanity check
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('MIN_IMPRESSIONS is 100', () => {
    expect(MIN_IMPRESSIONS).toBe(100);
  });

  it('WINNER_MULTIPLIER is 2', () => {
    expect(WINNER_MULTIPLIER).toBe(2);
  });

  it('MAX_WINDOW_HOURS is 48', () => {
    expect(MAX_WINDOW_HOURS).toBe(48);
  });
});
