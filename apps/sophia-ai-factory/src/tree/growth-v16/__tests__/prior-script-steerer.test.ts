import { describe, it, expect } from 'vitest';
import {
  calculateBetaMoments,
  derivePriorScriptSteering,
} from '../prior-script-steerer';

describe('Tree Layer: Bayesian Prior Script Steerer', () => {
  it('calculates mean and variance correctly for Beta distributions', () => {
    // Beta(2, 2) => mean = 0.5, var = 4 / (16 * 5) = 4 / 80 = 0.05
    const moments22 = calculateBetaMoments(2, 2);
    expect(moments22.mean).toBe(0.5);
    expect(moments22.variance).toBeCloseTo(0.05, 4);

    // Beta(8, 2) => mean = 0.8, var = 16 / (100 * 11) = 16 / 1100 = 0.014545
    const moments82 = calculateBetaMoments(8, 2);
    expect(moments82.mean).toBe(0.8);
    expect(moments82.variance).toBeCloseTo(0.014545, 4);
  });

  it('handles edge case of zero or negative parameters cleanly', () => {
    const fallback = calculateBetaMoments(0, 0);
    expect(fallback.mean).toBe(0.5);
    expect(fallback.variance).toBeGreaterThan(0);
  });

  it('tightens dropoff constraints and triggers high-velocity hook for weak historical retention', () => {
    // Hook retention has mean 0.2 (alpha=1, beta=4)
    const result = derivePriorScriptSteering({
      hookAlpha: 1,
      hookBeta: 4,
      retentionAlpha: 2,
      retentionBeta: 2,
      sampleSize: 15,
    });

    expect(result.expectedHookRetention).toBe(0.2);
    expect(result.steering.targetHookDropoffThreshold).toBe(18);
    expect(result.steering.winningHookArchetype).toBe('Pattern Interrupt');
    expect(result.steering.pacingDirective).toContain('High-velocity 3-second hook');
    expect(result.confidenceScore).toBeGreaterThan(0.5);
  });

  it('allows relaxed threshold and storytelling archetype for strong historical retention', () => {
    // Hook retention has mean 0.8 (alpha=8, beta=2)
    const result = derivePriorScriptSteering({
      hookAlpha: 8,
      hookBeta: 2,
      retentionAlpha: 7,
      retentionBeta: 3,
      sampleSize: 20,
    });

    expect(result.expectedHookRetention).toBe(0.8);
    expect(result.steering.targetHookDropoffThreshold).toBe(30);
    expect(result.steering.winningHookArchetype).toBe('Curiosity Gap / Contrast');
    expect(result.steering.pacingDirective).toContain('Storytelling hook');
    expect(result.steering.expectedRetentionMultiplier).toBeGreaterThan(1.1);
  });

  it('preserves user provided winning hook archetype when present', () => {
    const result = derivePriorScriptSteering({
      hookAlpha: 3,
      hookBeta: 3,
      retentionAlpha: 3,
      retentionBeta: 3,
      sampleSize: 5,
      winningHookArchetype: 'Before-After Bridge',
    });

    expect(result.steering.winningHookArchetype).toBe('Before-After Bridge');
  });
});
