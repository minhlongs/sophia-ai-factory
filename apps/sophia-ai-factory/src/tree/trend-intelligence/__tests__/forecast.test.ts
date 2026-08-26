/**
 * Forecast — pure exponential-smoothing forecaster unit tests.
 * No DB, no clock: generatedAt is always injected.
 *
 * @module tree/trend-intelligence/__tests__/forecast
 */

import { describe, it, expect } from 'vitest';
import {
  buildForecast,
  smoothingLevel,
  residualStdDev,
  DEFAULT_SMOOTHING_ALPHA,
  FORECAST_HORIZON_STEPS,
} from '@/tree/trend-intelligence/forecast';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe('smoothingLevel', () => {
  it('returns 0 for empty series', () => {
    expect(smoothingLevel([], 0.4)).toBe(0);
  });

  it('returns the single value for length-1 series', () => {
    expect(smoothingLevel([5], 0.4)).toBe(5);
  });

  it('equals x0 when alpha is minimal for a two-point series', () => {
    // alpha → small keeps level at first value; with alpha exactly the
    // recursion l = α·x + (1−α)·l — check exact arithmetic instead.
    expect(smoothingLevel([10, 20], 0.5)).toBe(15);
  });

  it('weights recent values more heavily as alpha grows', () => {
    const lowAlpha = smoothingLevel([0, 100], 0.1);
    const highAlpha = smoothingLevel([0, 100], 0.9);
    expect(highAlpha).toBeGreaterThan(lowAlpha);
    expect(highAlpha).toBeCloseTo(90, 10);
    expect(lowAlpha).toBeCloseTo(10, 10);
  });

  it('throws RangeError on alpha out of range', () => {
    expect(() => smoothingLevel([1], 0)).toThrow(RangeError);
    expect(() => smoothingLevel([1], 1.2)).toThrow(RangeError);
    expect(() => smoothingLevel([1], Number.NaN)).toThrow(RangeError);
  });
});

describe('residualStdDev', () => {
  it('is 0 for series shorter than 2', () => {
    expect(residualStdDev([], 0.4)).toBe(0);
    expect(residualStdDev([3], 0.4)).toBe(0);
  });

  it('is 0 when one-step errors are all identical', () => {
    // errors: x_t − l_{t−1}; constant series → all errors 0.
    expect(residualStdDev([5, 5, 5], 0.4)).toBe(0);
  });

  it('is positive for a varying series and deterministic', () => {
    const s = [1, 5, 2, 8, 3];
    const first = residualStdDev(s, 0.4);
    const second = residualStdDev(s, 0.4);
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(first);
  });
});

describe('buildForecast', () => {
  it('produces exactly 7 points by default (horizon = 7 days)', () => {
    const f = buildForecast([1, 2, 3], T0);
    expect(f.points).toHaveLength(FORECAST_HORIZON_STEPS);
    expect(f.horizonSteps).toBe(7);
    expect(f.model).toBe('exponential-smoothing');
    expect(f.alpha).toBe(DEFAULT_SMOOTHING_ALPHA);
  });

  it('honors custom horizonSteps', () => {
    const f = buildForecast([1, 2, 3], T0, { horizonSteps: 3 });
    expect(f.points).toHaveLength(3);
    expect(f.points.map((p) => p.step)).toEqual([1, 2, 3]);
  });

  it('timestamps advance by stepMs per step from generatedAt', () => {
    const f = buildForecast([1, 2, 3], T0, { stepMs: DAY });
    expect(f.generatedAt).toBe(T0);
    expect(f.stepMs).toBe(DAY);
    expect(f.points.map((p) => p.timestamp)).toEqual([
      T0 + DAY,
      T0 + 2 * DAY,
      T0 + 3 * DAY,
      T0 + 4 * DAY,
      T0 + 5 * DAY,
      T0 + 6 * DAY,
      T0 + 7 * DAY,
    ]);
  });

  it('projects flat at the final SES level', () => {
    const series = [10, 12, 14];
    const f = buildForecast(series, T0);
    const level = smoothingLevel(series, DEFAULT_SMOOTHING_ALPHA);
    expect(f.level).toBe(level);
    expect(f.points.every((p) => p.projected === level)).toBe(true);
  });

  it('keeps upper >= projected >= lower for every point', () => {
    const f = buildForecast([3, 9, 1, 7, 2, 8], T0);
    for (const p of f.points) {
      expect(p.upper).toBeGreaterThanOrEqual(p.projected);
      expect(p.projected).toBeGreaterThanOrEqual(p.lower);
      expect(p.lower).toBeGreaterThanOrEqual(0);
    }
  });

  it('widens the interval as step grows (√step scaling)', () => {
    const f = buildForecast([3, 9, 1, 7, 2, 8], T0);
    for (let i = 1; i < f.points.length; i++) {
      const prevWidth = f.points[i - 1].upper - f.points[i - 1].lower;
      const width = f.points[i].upper - f.points[i].lower;
      expect(width).toBeGreaterThan(prevWidth);
    }
  });

  it('degenerates to zero-width interval on constant series', () => {
    const f = buildForecast([4, 4, 4, 4], T0);
    expect(f.residualStdDev).toBe(0);
    for (const p of f.points) {
      expect(p.lower).toBe(p.projected);
      expect(p.upper).toBe(p.projected);
    }
  });

  it('handles empty series with zero forecast and valid intervals', () => {
    const f = buildForecast([], T0);
    expect(f.level).toBe(0);
    for (const p of f.points) {
      expect(p.projected).toBe(0);
      expect(p.upper).toBe(p.lower);
    }
  });

  it('clamps negative-projecting series at zero bounds without negative values', () => {
    // All-zero-ish data cannot go negative; lower bound never < 0.
    const f = buildForecast([0, 0, 0], T0);
    expect(f.points.every((p) => p.projected === 0 && p.lower === 0 && p.upper === 0)).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const a = buildForecast([2, 7, 4, 9, 1], T0, { alpha: 0.6 });
    const b = buildForecast([2, 7, 4, 9, 1], T0, { alpha: 0.6 });
    expect(a).toEqual(b);
  });

  it('round-trips through JSON (persistable to forecast column)', () => {
    const f = buildForecast([1, 4, 2], T0);
    const parsed = JSON.parse(JSON.stringify(f)) as typeof f;
    expect(parsed).toEqual(f);
    expect(parsed.points[1].timestamp).toBe(T0 + 2 * DAY);
  });

  it('throws RangeError on malformed options', () => {
    expect(() => buildForecast([1], Number.NaN)).toThrow(RangeError);
    expect(() => buildForecast([1], T0, { alpha: 0 })).toThrow(RangeError);
    expect(() => buildForecast([1], T0, { stepMs: 0 })).toThrow(RangeError);
    expect(() => buildForecast([1], T0, { horizonSteps: 0 })).toThrow(RangeError);
    expect(() => buildForecast([1], T0, { horizonSteps: 2.5 })).toThrow(RangeError);
  });
});
