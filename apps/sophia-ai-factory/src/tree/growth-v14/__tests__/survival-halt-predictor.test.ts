import { describe, it, expect } from 'vitest';
import { evaluateEarlyHaltSurvival } from '../survival-halt-predictor';

describe('Tree v14: Survival Halt Predictor', () => {
  it('triggers early halt when interim retention score is critically low', () => {
    const decision = evaluateEarlyHaltSurvival({
      interimRetentionScore: 0.1,
      priorAlpha: 2.0,
      priorBeta: 2.0,
      sampleSize: 20,
      criticalCutoffPercentile: 0.25,
    });

    expect(decision.shouldHalt).toBe(true);
    expect(decision.projectedMcuSavingsPct).toBe(65.0);
    expect(decision.reason).toContain('Halting to preserve GPU MCU budget');
  });

  it('allows rendering to continue when interim retention is healthy', () => {
    const decision = evaluateEarlyHaltSurvival({
      interimRetentionScore: 0.75,
      priorAlpha: 2.0,
      priorBeta: 2.0,
      sampleSize: 20,
      criticalCutoffPercentile: 0.25,
    });

    expect(decision.shouldHalt).toBe(false);
    expect(decision.projectedMcuSavingsPct).toBe(0.0);
    expect(decision.reason).toContain('Rendering approved for completion');
  });
});
