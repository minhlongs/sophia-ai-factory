import { describe, it, expect } from 'vitest';
import { calculateKellyAllocation } from '../kelly-allocator';

describe('Tree v14: Kelly Allocator', () => {
  it('allocates positive fraction when win probability and ROAS provide positive expectancy', () => {
    const result = calculateKellyAllocation(
      {
        winProbability: 0.6,
        projectedRoas: 2.0, // b = 1.0
        halfKelly: true,
        minFraction: 0.05,
        maxFraction: 0.40,
      },
      1000
    );

    // f* = (0.6 * 1.0 - 0.4) / 1.0 = 0.20
    // f_half = 0.10
    expect(result.isPositiveExpectancy).toBe(true);
    expect(result.unconstrainedFraction).toBeCloseTo(0.20, 2);
    expect(result.dampenedFraction).toBeCloseTo(0.10, 2);
    expect(result.boundedFraction).toBeCloseTo(0.10, 2);
    expect(result.allocatedMcu).toBe(100);
  });

  it('clamps to minFraction when expectancy is negative', () => {
    const result = calculateKellyAllocation(
      {
        winProbability: 0.2,
        projectedRoas: 1.5, // b = 0.5
        halfKelly: true,
        minFraction: 0.05,
        maxFraction: 0.40,
      },
      1000
    );

    // f* = (0.2 * 0.5 - 0.8) / 0.5 = -1.40
    expect(result.isPositiveExpectancy).toBe(false);
    expect(result.boundedFraction).toBe(0.05);
    expect(result.allocatedMcu).toBe(50);
  });

  it('handles zero budget gracefully', () => {
    const result = calculateKellyAllocation(
      {
        winProbability: 0.8,
        projectedRoas: 3.0,
        halfKelly: true,
        minFraction: 0.05,
        maxFraction: 0.40,
      },
      0
    );

    expect(result.allocatedMcu).toBe(0);
    expect(result.boundedFraction).toBe(0);
  });
});
