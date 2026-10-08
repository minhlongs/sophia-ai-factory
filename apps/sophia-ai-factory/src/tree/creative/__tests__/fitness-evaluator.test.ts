/**
 * @file fitness-evaluator.test.ts
 * @description Unit tests for Darwinian fitness evaluator and promotion logic
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFitnessScore,
  evaluateOffspringFitness,
  PROMOTION_GAIN_THRESHOLD_PERCENT,
} from '../fitness-evaluator';

describe('Tree Creative Fitness Evaluator', () => {
  it('calculates weighted composite fitness score correctly', () => {
    // 50% * 80 + 35% * 70 + 15% * 50 = 40 + 24.5 + 7.5 = 72.0
    const fitness = calculateFitnessScore(80, 70, 50);
    expect(fitness).toBe(72.0);
  });

  it('caps metric inputs to 0-100 range', () => {
    const cappedFitness = calculateFitnessScore(120, -10, 150);
    // 50% * 100 + 35% * 0 + 15% * 100 = 50 + 0 + 15 = 65.0
    expect(cappedFitness).toBe(65.0);
  });

  it('qualifies high-gain offspring as PROMOTED_OFFSPRING when delta >= 15%', () => {
    const evaluation = evaluateOffspringFitness(60.0, {
      hookScore: 90,
      retentionScore: 85,
      roiPercent: 60,
    });
    // 50% * 90 + 35% * 85 + 15% * 60 = 45 + 29.75 + 9 = 83.75 -> 83.8
    // gain = (83.8 - 60) / 60 = 23.8 / 60 = 39.7%
    expect(evaluation.isPromotedOffspring).toBe(true);
    expect(evaluation.gainVsParentPercent).toBeGreaterThanOrEqual(PROMOTION_GAIN_THRESHOLD_PERCENT);
  });

  it('rejects low-gain offspring when delta < 15%', () => {
    const evaluation = evaluateOffspringFitness(75.0, {
      hookScore: 78,
      retentionScore: 74,
      roiPercent: 40,
    });
    // Composite fitness is around ~71, which is a decline
    expect(evaluation.isPromotedOffspring).toBe(false);
    expect(evaluation.gainVsParentPercent).toBeLessThan(PROMOTION_GAIN_THRESHOLD_PERCENT);
  });
});
