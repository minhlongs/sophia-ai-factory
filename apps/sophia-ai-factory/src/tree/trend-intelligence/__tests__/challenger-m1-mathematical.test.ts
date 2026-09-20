/**
 * Challenger Empirical Verification Suite: Milestone 1 Mathematical Stability
 *
 * Adversarial stress tests for:
 * 1. Hook scoring formula boundary values:
 *    - scores at 0, 1, out-of-range clamping (<0, >1, +/-Infinity)
 *    - precision drift, floating-point invariance, Monte Carlo fuzzing
 *    - handling of non-numeric / NaN values
 * 2. Simple Exponential Smoothing (SES) forecasting:
 *    - 0 variance (flat lines, constant series, zeros)
 *    - monotonic increasing / decreasing series (lag analysis, confidence interval expansion)
 *    - outlier spikes (positive impulse, negative dip, decay dynamics)
 *    - alpha boundary values and length degeneration
 * 3. Z-score and momentum calculation in detect-math:
 *    - zero variance, short arrays, extreme slopes
 * 4. Viral feedback CES mathematical stability:
 *    - zero telemetry, division-by-zero guards, saturation limits
 *
 * Layer: tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHookScore,
  classifyHookStyle,
  VIRAL_SCORE_WEIGHTS,
  CANONICAL_HOOK_STYLES,
} from '../hook-scorer';
import {
  buildForecast,
  smoothingLevel,
  residualStdDev,
  DEFAULT_SMOOTHING_ALPHA,
  FORECAST_HORIZON_STEPS,
} from '../forecast';
import { computeTopicMomentum, bucketEvidence } from '../detect-math';
import { calculateViralCES } from '@/tree/learning-loop/scoring-cas';

describe('Challenger M1: Mathematical Stability & Adversarial Stress Tests', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Hook Scoring Formula Boundary & Precision
  // ══════════════════════════════════════════════════════════════════════════
  describe('1. Hook Scoring Boundary Values & Precision Stability', () => {
    it('1.1 exact boundaries: all zeroes and all ones', () => {
      const zero = calculateHookScore({
        hookText: 'Test hook zero',
        scores: { hookScore: 0, pacingScore: 0, retentionScore: 0, ctaScore: 0 },
      });
      expect(zero.viralScore).toBe(0.0);
      expect(zero.hookScore).toBe(0);
      expect(zero.pacingScore).toBe(0);
      expect(zero.retentionScore).toBe(0);
      expect(zero.ctaScore).toBe(0);

      const one = calculateHookScore({
        hookText: 'Test hook one',
        scores: { hookScore: 1, pacingScore: 1, retentionScore: 1, ctaScore: 1 },
      });
      expect(one.viralScore).toBe(1.0);
      expect(one.hookScore).toBe(1);
      expect(one.pacingScore).toBe(1);
      expect(one.retentionScore).toBe(1);
      expect(one.ctaScore).toBe(1);
    });

    it('1.2 isolated unitary components match individual canonical weights', () => {
      // S_viral = 0.40 * hook + 0.25 * pacing + 0.20 * retention + 0.15 * cta
      const hookOnly = calculateHookScore({
        hookText: 'Hook only',
        scores: { hookScore: 1, pacingScore: 0, retentionScore: 0, ctaScore: 0 },
      });
      expect(hookOnly.viralScore).toBe(0.4);

      const pacingOnly = calculateHookScore({
        hookText: 'Pacing only',
        scores: { hookScore: 0, pacingScore: 1, retentionScore: 0, ctaScore: 0 },
      });
      expect(pacingOnly.viralScore).toBe(0.25);

      const retentionOnly = calculateHookScore({
        hookText: 'Retention only',
        scores: { hookScore: 0, pacingScore: 0, retentionScore: 1, ctaScore: 0 },
      });
      expect(retentionOnly.viralScore).toBe(0.2);

      const ctaOnly = calculateHookScore({
        hookText: 'CTA only',
        scores: { hookScore: 0, pacingScore: 0, retentionScore: 0, ctaScore: 1 },
      });
      expect(ctaOnly.viralScore).toBe(0.15);
    });

    it('1.3 clamps extreme out-of-range inputs (<0, >1, +/-Infinity)', () => {
      // Extremely negative
      const neg = calculateHookScore({
        hookText: 'Negative out of range',
        scores: {
          hookScore: -999999,
          pacingScore: -0.0001,
          retentionScore: -Infinity,
          ctaScore: -42,
        },
      });
      expect(neg.hookScore).toBe(0);
      expect(neg.pacingScore).toBe(0);
      expect(neg.retentionScore).toBe(0);
      expect(neg.ctaScore).toBe(0);
      expect(neg.viralScore).toBe(0.0);

      // Extremely positive
      const pos = calculateHookScore({
        hookText: 'Positive out of range',
        scores: {
          hookScore: 999999,
          pacingScore: 1.0001,
          retentionScore: Infinity,
          ctaScore: 100,
        },
      });
      expect(pos.hookScore).toBe(1);
      expect(pos.pacingScore).toBe(1);
      expect(pos.retentionScore).toBe(1);
      expect(pos.ctaScore).toBe(1);
      expect(pos.viralScore).toBe(1.0);

      // Mixed extreme
      const mixed = calculateHookScore({
        hookText: 'Mixed extreme',
        scores: {
          hookScore: 50, // -> 1.0 (weight 0.40)
          pacingScore: -10, // -> 0.0 (weight 0.25)
          retentionScore: 0.5, // -> 0.5 (weight 0.20 * 0.5 = 0.10)
          ctaScore: -0.01, // -> 0.0 (weight 0.15)
        },
      });
      expect(mixed.viralScore).toBe(0.5); // 0.40 + 0.10 = 0.50
    });

    it('1.4 precision drift: floating point representation and rounding stability', () => {
      // 0.1 + 0.2 floating point inaccuracy in JS
      const floatCase = calculateHookScore({
        hookText: 'Float case',
        scores: {
          hookScore: 0.1,
          pacingScore: 0.2,
          retentionScore: 0.3,
          ctaScore: 0.4,
        },
      });
      // 0.40 * 0.1 = 0.04
      // 0.25 * 0.2 = 0.05
      // 0.20 * 0.3 = 0.06
      // 0.15 * 0.4 = 0.06
      // sum = 0.21
      expect(floatCase.viralScore).toBe(0.21);

      // Sub-cent fractional rounding (0.835 -> 0.84)
      const roundUp = calculateHookScore({
        hookText: 'Round up',
        scores: {
          hookScore: 0.9,
          pacingScore: 0.8,
          retentionScore: 0.85,
          ctaScore: 0.7,
        },
      });
      expect(roundUp.viralScore).toBe(0.84);

      // Sub-cent fractional rounding (0.834 -> 0.83)
      // 0.40*0.90 + 0.25*0.80 + 0.20*0.82 + 0.15*0.70
      // = 0.36 + 0.20 + 0.164 + 0.105 = 0.829 -> 0.83
      const roundDown = calculateHookScore({
        hookText: 'Round down',
        scores: {
          hookScore: 0.9,
          pacingScore: 0.8,
          retentionScore: 0.82,
          ctaScore: 0.7,
        },
      });
      expect(roundDown.viralScore).toBe(0.83);

      // Tiny epsilon: 1e-12 should cleanly round to 0.00
      const epsilon = calculateHookScore({
        hookText: 'Epsilon',
        scores: {
          hookScore: 1e-12,
          pacingScore: 1e-12,
          retentionScore: 1e-12,
          ctaScore: 1e-12,
        },
      });
      expect(epsilon.viralScore).toBe(0.0);

      // 0.999999 should round to 1.00
      const nearOne = calculateHookScore({
        hookText: 'Near one',
        scores: {
          hookScore: 0.99999,
          pacingScore: 0.99999,
          retentionScore: 0.99999,
          ctaScore: 0.99999,
        },
      });
      expect(nearOne.viralScore).toBe(1.0);
    });

    it('1.5 Monte Carlo fuzz test: 10,000 randomized score tuples satisfy invariants', () => {
      let seed = 123456789;
      // Linear congruential generator for reproducible pseudo-random numbers
      function rng(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 10000; i++) {
        // Random range [-2, 3] covering valid and out-of-bound values
        const h = rng() * 5 - 2;
        const p = rng() * 5 - 2;
        const r = rng() * 5 - 2;
        const c = rng() * 5 - 2;

        const res = calculateHookScore({
          hookText: `Fuzz test ${i}`,
          scores: { hookScore: h, pacingScore: p, retentionScore: r, ctaScore: c },
        });

        // Invariant 1: Range [0.00, 1.00]
        expect(res.viralScore).toBeGreaterThanOrEqual(0.0);
        expect(res.viralScore).toBeLessThanOrEqual(1.0);

        // Invariant 2: Exactly at most 2 decimal places
        const rounded = Math.round(res.viralScore * 100) / 100;
        expect(res.viralScore).toBe(rounded);

        // Invariant 3: Clamped component scores in [0, 1]
        expect(res.hookScore).toBeGreaterThanOrEqual(0);
        expect(res.hookScore).toBeLessThanOrEqual(1);
        expect(res.pacingScore).toBeGreaterThanOrEqual(0);
        expect(res.pacingScore).toBeLessThanOrEqual(1);
        expect(res.retentionScore).toBeGreaterThanOrEqual(0);
        expect(res.retentionScore).toBeLessThanOrEqual(1);
        expect(res.ctaScore).toBeGreaterThanOrEqual(0);
        expect(res.ctaScore).toBeLessThanOrEqual(1);
      }
    });

    it('1.6 monotonic non-decreasing invariant under score improvements', () => {
      // If any score increases while others stay constant, viralScore must be >= previous
      const baseline = calculateHookScore({
        hookText: 'Monotonic test',
        scores: { hookScore: 0.5, pacingScore: 0.5, retentionScore: 0.5, ctaScore: 0.5 },
      });

      const higherHook = calculateHookScore({
        hookText: 'Monotonic test',
        scores: { hookScore: 0.7, pacingScore: 0.5, retentionScore: 0.5, ctaScore: 0.5 },
      });
      expect(higherHook.viralScore).toBeGreaterThanOrEqual(baseline.viralScore);

      const higherPacing = calculateHookScore({
        hookText: 'Monotonic test',
        scores: { hookScore: 0.5, pacingScore: 0.7, retentionScore: 0.5, ctaScore: 0.5 },
      });
      expect(higherPacing.viralScore).toBeGreaterThanOrEqual(baseline.viralScore);

      const higherRetention = calculateHookScore({
        hookText: 'Monotonic test',
        scores: { hookScore: 0.5, pacingScore: 0.5, retentionScore: 0.7, ctaScore: 0.5 },
      });
      expect(higherRetention.viralScore).toBeGreaterThanOrEqual(baseline.viralScore);

      const higherCta = calculateHookScore({
        hookText: 'Monotonic test',
        scores: { hookScore: 0.5, pacingScore: 0.5, retentionScore: 0.5, ctaScore: 0.7 },
      });
      expect(higherCta.viralScore).toBeGreaterThanOrEqual(baseline.viralScore);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Simple Exponential Smoothing (SES) Forecasting
  // ══════════════════════════════════════════════════════════════════════════
  describe('2. SES Forecasting Mathematical Stability', () => {
    const T0 = 1_700_000_000_000;

    describe('2.1 Zero Variance Series', () => {
      it('retains constant level and zero residualStdDev on identical counts', () => {
        const constantSeries = [45, 45, 45, 45, 45, 45, 45];
        const f = buildForecast(constantSeries, T0, { alpha: 0.4 });

        expect(f.level).toBe(45);
        expect(f.residualStdDev).toBe(0);

        for (const p of f.points) {
          expect(p.projected).toBe(45);
          expect(p.lower).toBe(45);
          expect(p.upper).toBe(45);
        }
      });

      it('handles all-zero series with zero projected and zero bounds', () => {
        const zeros = [0, 0, 0, 0, 0];
        const f = buildForecast(zeros, T0, { alpha: 0.4 });

        expect(f.level).toBe(0);
        expect(f.residualStdDev).toBe(0);

        for (const p of f.points) {
          expect(p.projected).toBe(0);
          expect(p.lower).toBe(0);
          expect(p.upper).toBe(0);
        }
      });

      it('handles large constant counts without precision overflow', () => {
        const large = [1e9, 1e9, 1e9, 1e9];
        const f = buildForecast(large, T0, { alpha: 0.4 });

        expect(f.level).toBe(1e9);
        expect(f.residualStdDev).toBe(0);
        expect(f.points[0].projected).toBe(1e9);
        expect(f.points[0].lower).toBe(1e9);
        expect(f.points[0].upper).toBe(1e9);
      });
    });

    describe('2.2 Monotonic Series & SES Lag Analysis', () => {
      it('demonstrates theoretical SES lag property on strictly increasing series', () => {
        // SES on linear trend x_t = 10 * t lags by (1 - alpha) / alpha * slope
        // For alpha = 0.4, slope = 10: lag = (0.6 / 0.4) * 10 = 15
        const series = [10, 20, 30, 40, 50, 60, 70];
        const level = smoothingLevel(series, 0.4);

        // Theoretical asymptotic level after lag is 70 - 15 = 55
        // Due to finite start at t=0 (l0=10), actual level is approx 55.7
        expect(level).toBeLessThan(70);
        expect(level).toBeGreaterThan(50);
        expect(level).toBeCloseTo(55.7, 1);

        // Errors are consistently positive (lagging behind)
        const sigma = residualStdDev(series, 0.4);
        expect(sigma).toBeGreaterThan(0);
        expect(Number.isFinite(sigma)).toBe(true);

        const f = buildForecast(series, T0, { alpha: 0.4 });
        expect(f.points).toHaveLength(7);

        // Invariants on all forecast points
        for (let i = 0; i < f.points.length; i++) {
          const pt = f.points[i];
          expect(pt.projected).toBe(level);
          expect(pt.lower).toBeGreaterThanOrEqual(0);
          expect(pt.upper).toBeGreaterThanOrEqual(pt.projected);
          expect(pt.projected).toBeGreaterThanOrEqual(pt.lower);

          if (i > 0) {
            // Confidence intervals widen with sqrt(step)
            const prevWidth = f.points[i - 1].upper - f.points[i - 1].lower;
            const currentWidth = pt.upper - pt.lower;
            expect(currentWidth).toBeGreaterThan(prevWidth);
          }
        }
      });

      it('handles strictly decreasing series and ensures lower bound never drops below 0', () => {
        const decreasing = [100, 70, 40, 15, 5, 1];
        const f = buildForecast(decreasing, T0, { alpha: 0.4 });

        expect(f.level).toBeGreaterThan(0);
        for (const pt of f.points) {
          expect(pt.projected).toBeGreaterThan(0);
          expect(pt.lower).toBeGreaterThanOrEqual(0);
          expect(pt.upper).toBeGreaterThanOrEqual(pt.projected);
        }
      });

      it('handles exponential explosive growth series stably', () => {
        const exponential = [1, 2, 4, 8, 16, 32, 64, 128, 256];
        const f = buildForecast(exponential, T0, { alpha: 0.4 });

        expect(f.level).toBeGreaterThan(100);
        expect(Number.isFinite(f.level)).toBe(true);
        expect(Number.isFinite(f.residualStdDev)).toBe(true);
        expect(f.points.every((p) => p.upper >= p.projected && p.projected >= p.lower)).toBe(true);
      });
    });

    describe('2.3 Outlier Spikes & Impulse Response', () => {
      it('correctly models single massive impulse spike and exponential decay', () => {
        // Baseline 10, spike to 10000 at index 3, then return to 10
        const spikeSeries = [10, 10, 10, 10000, 10, 10, 10];
        const f = buildForecast(spikeSeries, T0, { alpha: 0.4 });

        // Level should be pulled up significantly by the spike, but decayed by (1 - alpha)
        expect(f.level).toBeGreaterThan(10);
        expect(f.level).toBeLessThan(10000);

        // Standard deviation of residuals should capture the massive volatility
        expect(f.residualStdDev).toBeGreaterThan(1000);

        // Crucial invariant: even though margin exceeds projected, lower bound MUST NOT BE NEGATIVE
        for (const pt of f.points) {
          expect(pt.lower).toBe(0); // Clamped at 0 because projected - margin < 0
          expect(pt.upper).toBeGreaterThan(pt.projected);
          expect(pt.projected).toBeGreaterThan(0);
        }
      });

      it('handles sudden zero drops and recovers variance gracefully', () => {
        const dropSeries = [100, 100, 100, 0, 100, 100];
        const f = buildForecast(dropSeries, T0, { alpha: 0.4 });

        expect(f.level).toBeGreaterThan(50);
        expect(f.residualStdDev).toBeGreaterThan(0);
        expect(f.points.every((p) => p.lower >= 0)).toBe(true);
      });

      it('handles alternating volatility pattern [0, 100, 0, 100, 0, 100]', () => {
        const alternating = [0, 100, 0, 100, 0, 100];
        const f = buildForecast(alternating, T0, { alpha: 0.4 });

        expect(f.level).toBeGreaterThan(30);
        expect(f.level).toBeLessThan(80);
        expect(f.residualStdDev).toBeGreaterThan(0);
        expect(f.points.every((p) => p.upper >= p.projected && p.projected >= p.lower && p.lower >= 0)).toBe(true);
      });
    });

    describe('2.4 Alpha Boundary Value Behavior', () => {
      it('alpha = 1.0 reflects instant memory (level equals last observation)', () => {
        const series = [10, 25, 50, 99];
        const level = smoothingLevel(series, 1.0);
        expect(level).toBe(99);
      });

      it('alpha close to zero (0.001) retains strong inertia near initial observation', () => {
        const series = [100, 10, 10, 10, 10];
        const level = smoothingLevel(series, 0.001);
        // After 4 steps with alpha 0.001, level is approx 100 * (0.999)^4 + small
        expect(level).toBeGreaterThan(95);
      });

      it('throws RangeError on non-finite, zero, or out-of-range alpha', () => {
        expect(() => smoothingLevel([10], 0)).toThrow(RangeError);
        expect(() => smoothingLevel([10], -0.1)).toThrow(RangeError);
        expect(() => smoothingLevel([10], 1.0001)).toThrow(RangeError);
        expect(() => smoothingLevel([10], NaN)).toThrow(RangeError);
        expect(() => smoothingLevel([10], Infinity)).toThrow(RangeError);
      });
    });

    describe('2.5 Series Length Degeneracy & Edge Shapes', () => {
      it('empty series produces 0 level and 0 residualStdDev without error', () => {
        const f = buildForecast([], T0);
        expect(f.level).toBe(0);
        expect(f.residualStdDev).toBe(0);
        expect(f.points.every((p) => p.projected === 0 && p.lower === 0 && p.upper === 0)).toBe(true);
      });

      it('single observation series produces exact level with 0 residualStdDev', () => {
        const f = buildForecast([777], T0);
        expect(f.level).toBe(777);
        expect(f.residualStdDev).toBe(0);
        expect(f.points.every((p) => p.projected === 777 && p.lower === 777 && p.upper === 777)).toBe(true);
      });

      it('two observation series produces valid level and zero residualStdDev (single error variance is 0)', () => {
        // With length 2, errors array has 1 element: variance of 1 element is 0
        const f = buildForecast([10, 20], T0, { alpha: 0.5 });
        expect(f.level).toBe(15);
        expect(f.residualStdDev).toBe(0);
      });

      it('three observation series produces non-zero residualStdDev on varying errors', () => {
        const f = buildForecast([10, 50, 10], T0, { alpha: 0.4 });
        expect(f.residualStdDev).toBeGreaterThan(0);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: Momentum & Z-Score Stability in detect-math
  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Trend Momentum & Z-Score Mathematical Stability', () => {
    it('3.1 zero variance window counts guard against division by zero', () => {
      const stats = computeTopicMomentum('ai tools', [5, 5, 5, 5, 5, 5, 5]);
      expect(stats.velocity).toBe(0);
      expect(stats.z).toBe(0); // Protected: sd is 0, so z is 0, NOT NaN!
      expect(stats.momentum).toBe(0);
    });

    it('3.2 handles empty or 1-element counts gracefully', () => {
      const empty = computeTopicMomentum('ai tools', []);
      expect(empty.velocity).toBe(0);
      expect(empty.z).toBe(0);
      expect(empty.momentum).toBe(0);

      const single = computeTopicMomentum('ai tools', [42]);
      expect(single.velocity).toBe(0);
      expect(single.z).toBe(0);
      expect(single.momentum).toBe(0);
    });

    it('3.3 correctly calculates positive momentum on late surge', () => {
      const surge = computeTopicMomentum('ai tools', [1, 1, 1, 1, 1, 2, 20]);
      expect(surge.velocity).toBe(18); // 20 - 2
      expect(surge.z).toBeGreaterThan(1.5);
      expect(surge.momentum).toBeGreaterThan(0);
    });

    it('3.4 correctly calculates negative momentum on sharp decline', () => {
      const decline = computeTopicMomentum('ai tools', [20, 20, 20, 20, 20, 18, 1]);
      expect(decline.velocity).toBe(-17); // 1 - 18
      expect(decline.z).toBeLessThan(-1.0);
      expect(decline.momentum).toBeLessThan(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 4: Viral Feedback CES Mathematical Stability
  // ══════════════════════════════════════════════════════════════════════════
  describe('4. Viral Feedback CES Mathematical Rigor', () => {
    it('4.1 handles all-zero telemetry without division by zero or NaN', () => {
      const ces = calculateViralCES({
        videoId: 'vid_zero',
        platform: 'tiktok',
        views: 0,
        shares: 0,
        likes: 0,
        comments: 0,
        clicks: 0,
        conversions: 0,
        completionRate: 0,
      });

      expect(ces).toBe(0);
      expect(Number.isFinite(ces)).toBe(true);
      expect(Number.isNaN(ces)).toBe(false);
    });

    it('4.2 clamps perfectly at 100 on saturated viral metrics', () => {
      const ces = calculateViralCES({
        videoId: 'vid_viral_overload',
        platform: 'tiktok',
        views: 1000000,
        shares: 100000, // 10% share rate (saturated at 3%)
        likes: 500000,
        comments: 50000,
        clicks: 200000,
        conversions: 50000,
        completionRate: 1.0, // 100% completion
        impressions: 1000000,
      });

      expect(ces).toBe(100);
    });

    it('4.3 guards against negative or out-of-bound completion rates', () => {
      const neg = calculateViralCES({
        videoId: 'vid_neg',
        platform: 'tiktok',
        completionRate: -0.5,
      });
      expect(neg).toBe(0);

      const overflow = calculateViralCES({
        videoId: 'vid_overflow',
        platform: 'tiktok',
        completionRate: 2.5,
        views: 100,
      });
      // R capped at 1.0 (weight 35%) -> CES = 35
      expect(overflow).toBe(35);
    });

    it('4.4 computes duration-based completion rate when watchTime and duration provided', () => {
      const ces = calculateViralCES({
        videoId: 'vid_duration',
        platform: 'tiktok',
        views: 1000,
        watchTimeSeconds: 45,
        totalDurationSeconds: 60, // 45 / 60 = 0.75 completion rate
      });
      // R = 0.75 * 35 = 26.25
      expect(ces).toBe(26.25);
    });

    it('4.5 immunizes against NaN inputs across all telemetry fields', () => {
      const ces = calculateViralCES({
        videoId: 'vid_nan_poison',
        platform: 'tiktok',
        views: NaN,
        shares: NaN,
        likes: NaN,
        comments: NaN,
        clicks: NaN,
        conversions: NaN,
        completionRate: NaN,
      });

      expect(ces).toBe(0);
      expect(Number.isFinite(ces)).toBe(true);
      expect(Number.isNaN(ces)).toBe(false);
    });

    it('4.6 immunizes against Infinity and -Infinity in telemetry', () => {
      const ces = calculateViralCES({
        videoId: 'vid_inf_poison',
        platform: 'tiktok',
        views: Infinity,
        shares: -Infinity,
        likes: Infinity,
        completionRate: Infinity,
      });

      expect(Number.isFinite(ces)).toBe(true);
      expect(ces).toBeGreaterThanOrEqual(0);
      expect(ces).toBeLessThanOrEqual(100);
    });
  });
});
