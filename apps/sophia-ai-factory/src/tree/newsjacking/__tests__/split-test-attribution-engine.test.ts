/**
 * @file split-test-attribution-engine.test.ts
 * @description Unit tests for video split-test attribution & auto loss-cut
 */

import { describe, it, expect } from 'vitest';
import { evaluateSplitTestAttribution } from '../split-test-attribution-engine';

describe('evaluateSplitTestAttribution', () => {
  it('returns INSUFFICIENT_DATA when sample size is below threshold', () => {
    const result = evaluateSplitTestAttribution({
      experimentId: 'exp_01',
      variantA: { views: 50, clicks: 10, conversions: 2 },
      variantB: { views: 40, clicks: 8, conversions: 1 },
      minViewsThreshold: 100,
    });

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.winnerVariant).toBe('INCONCLUSIVE');
    expect(result.trafficAllocationRecommendation.allocationRatioA).toBe(0.5);
  });

  it('declares WINNER_DECLARED for Hook A when it outperforms Hook B moderately', () => {
    const result = evaluateSplitTestAttribution({
      experimentId: 'exp_02',
      variantA: { views: 1000, clicks: 250, conversions: 35 }, // 3.5%
      variantB: { views: 1000, clicks: 120, conversions: 12 }, // 1.2%
      minViewsThreshold: 100,
    });

    expect(result.status).toBe('WINNER_DECLARED');
    expect(result.winnerVariant).toBe('VARIANT_A');
    expect(result.conversionRateA).toBe(3.5);
    expect(result.trafficAllocationRecommendation.allocationRatioA).toBe(0.8);
  });

  it('triggers AUTO_CUT_TRIGGERED when losing variant severely drags performance', () => {
    const result = evaluateSplitTestAttribution({
      experimentId: 'exp_03',
      variantA: { views: 2000, clicks: 600, conversions: 60 }, // 3.0%
      variantB: { views: 2000, clicks: 40, conversions: 4 },   // 0.2%
      minViewsThreshold: 100,
    });

    expect(result.status).toBe('AUTO_CUT_TRIGGERED');
    expect(result.winnerVariant).toBe('VARIANT_A');
    expect(result.trafficAllocationRecommendation.allocationRatioA).toBe(1.0);
    expect(result.trafficAllocationRecommendation.allocationRatioB).toBe(0.0);
    expect(result.recommendationReason).toContain('Auto-Cut');
  });

  it('keeps RUNNING when conversion rates are closely matched', () => {
    const result = evaluateSplitTestAttribution({
      experimentId: 'exp_04',
      variantA: { views: 1000, clicks: 200, conversions: 22 }, // 2.2%
      variantB: { views: 1000, clicks: 210, conversions: 20 }, // 2.0%
      minViewsThreshold: 100,
    });

    expect(result.status).toBe('RUNNING');
    expect(result.winnerVariant).toBe('INCONCLUSIVE');
    expect(result.trafficAllocationRecommendation.allocationRatioA).toBe(0.5);
  });
});
