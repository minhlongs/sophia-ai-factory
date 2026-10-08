/**
 * @file survival-retention-engine.test.ts
 * @description Unit tests for Kaplan-Meier Survival Retention Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  computeKaplanMeierSurvivalCurve,
  detectRetentionCliffs,
  evaluateRetentionStatus,
} from '../survival-retention-engine';
import type {
  RetentionSecondBucket,
  RetentionCliff,
} from '@/seed/types/growth-triad-v6-types';

describe('Survival Retention Engine', () => {
  it('computes monotonic non-increasing Kaplan-Meier survival curve', () => {
    const buckets: RetentionSecondBucket[] = [
      { second: 0, viewers: 1000, dropoffs: 0 },
      { second: 1, viewers: 1000, dropoffs: 50 },
      { second: 2, viewers: 950, dropoffs: 50 },
      { second: 3, viewers: 900, dropoffs: 100 },
    ];

    const curve = computeKaplanMeierSurvivalCurve(buckets);
    expect(curve).toHaveLength(4);
    expect(curve[0].survivalRate).toBe(1.0);
    expect(curve[1].survivalRate).toBeCloseTo(0.95, 2);
    expect(curve[2].survivalRate).toBeLessThan(curve[1].survivalRate);
    expect(curve[3].survivalRate).toBeLessThan(curve[2].survivalRate);
  });

  it('detects retention drop-off cliff when rate exceeds threshold', () => {
    const buckets: RetentionSecondBucket[] = [
      { second: 10, viewers: 1000, dropoffs: 10 },
      { second: 11, viewers: 990, dropoffs: 250 }, // Massive drop ~ 25%
      { second: 12, viewers: 740, dropoffs: 100 },
      { second: 13, viewers: 640, dropoffs: 10 },
    ];

    const curve = computeKaplanMeierSurvivalCurve(buckets);
    const cliffs = detectRetentionCliffs(curve, 0.08);

    expect(cliffs.length).toBeGreaterThanOrEqual(1);
    expect(cliffs[0].startSecond).toBe(11);
    expect(cliffs[0].dropSeverity).toBeGreaterThanOrEqual(0.08);
    expect(cliffs[0].recommendedTrimSec).toBeGreaterThanOrEqual(1);
  });

  it('evaluates retention status transitions correctly', () => {
    const noCliffs: RetentionCliff[] = [];
    const withCliffs: RetentionCliff[] = [
      { startSecond: 15, endSecond: 17, dropSeverity: 0.12, recommendedTrimSec: 3 },
    ];

    expect(evaluateRetentionStatus(0.75, noCliffs)).toBe('PACING_OPTIMIZED');
    expect(evaluateRetentionStatus(0.65, withCliffs)).toBe('CLIFF_DETECTED');
    expect(evaluateRetentionStatus(0.40, withCliffs)).toBe('TRIM_RECOMMENDED');
  });

  it('handles empty bucket input gracefully', () => {
    expect(computeKaplanMeierSurvivalCurve([])).toEqual([]);
    expect(detectRetentionCliffs([])).toEqual([]);
  });
});
