import { describe, it, expect } from 'vitest';
import { updateConjugatePrior } from '../prior-updater';

describe('updateConjugatePrior', () => {
  it('updates uninformative prior with high observed score', () => {
    const res = updateConjugatePrior({
      currentAlpha: 1.0,
      currentBeta: 1.0,
      sampleSize: 10,
      observedScore: 0.9,
      dampeningFactor: 1.0,
    });

    // deltaAlpha = 0.9 * 10 = 9; deltaBeta = 0.1 * 10 = 1
    expect(res.updatedAlpha).toBeCloseTo(10.0);
    expect(res.updatedBeta).toBeCloseTo(2.0);
    expect(res.expectedValue).toBeCloseTo(10 / 12);
    expect(res.variance).toBeGreaterThan(0);
  });

  it('clamps extreme observed scores to [0, 1]', () => {
    const resNegative = updateConjugatePrior({
      currentAlpha: 1.0,
      currentBeta: 1.0,
      sampleSize: 5,
      observedScore: -0.5,
      dampeningFactor: 1.0,
    });
    // score clamped to 0 -> deltaAlpha = 0, deltaBeta = 5
    expect(resNegative.updatedAlpha).toBe(1.0);
    expect(resNegative.updatedBeta).toBe(6.0);

    const resOverflow = updateConjugatePrior({
      currentAlpha: 1.0,
      currentBeta: 1.0,
      sampleSize: 5,
      observedScore: 1.5,
      dampeningFactor: 1.0,
    });
    // score clamped to 1 -> deltaAlpha = 5, deltaBeta = 0
    expect(resOverflow.updatedAlpha).toBe(6.0);
    expect(resOverflow.updatedBeta).toBe(1.0);
  });

  it('applies dampening factor properly', () => {
    const res = updateConjugatePrior({
      currentAlpha: 2.0,
      currentBeta: 2.0,
      sampleSize: 10,
      observedScore: 0.8,
      dampeningFactor: 0.5,
    });
    // effectiveWeight = 10 * 0.5 = 5
    // deltaAlpha = 0.8 * 5 = 4; deltaBeta = 0.2 * 5 = 1
    expect(res.updatedAlpha).toBeCloseTo(6.0);
    expect(res.updatedBeta).toBeCloseTo(3.0);
    expect(res.expectedValue).toBeCloseTo(6 / 9);
  });
});
