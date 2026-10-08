import { describe, it, expect } from 'vitest';
import {
  evaluateBanditExperiment,
  calculateUCB1,
} from '../thompson-bandit';
import { BanditArm } from '@/seed/types/growth-triad-v13';

describe('Thompson Sampling & UCB1 Multi-Armed Bandit Engine', () => {
  it('calculates UCB1 score with exploration bonus', () => {
    const score0 = calculateUCB1(0, 0, 100);
    expect(score0).toBe(999.0);

    const score1 = calculateUCB1(10, 50, 100);
    // exploitation = 0.2, exploration > 0
    expect(score1).toBeGreaterThan(0.2);
  });

  it('evaluates arms and detects clear winner after sufficient pulls', () => {
    const arms: BanditArm[] = [
      {
        id: 'arm-poor',
        experimentId: 'exp-1',
        hookText: 'Suboptimal hook text',
        alphaSuccesses: 2,
        betaFailures: 98,
        pullCount: 100,
        conversionCount: 2,
        trafficWeight: 0.5,
        status: 'ACTIVE',
      },
      {
        id: 'arm-dominant',
        experimentId: 'exp-1',
        hookText: 'Viral converting hook',
        alphaSuccesses: 60,
        betaFailures: 40,
        pullCount: 100,
        conversionCount: 60,
        trafficWeight: 0.5,
        status: 'ACTIVE',
      },
    ];

    const result = evaluateBanditExperiment('exp-1', arms, 200, 50, 0.95);
    expect(result.converged).toBe(true);
    expect(result.winningArmId).toBe('arm-dominant');

    const dominantEval = result.evaluations.find((e) => e.armId === 'arm-dominant');
    const poorEval = result.evaluations.find((e) => e.armId === 'arm-poor');

    expect(dominantEval?.isWinner).toBe(true);
    expect(dominantEval?.allocatedWeight).toBeGreaterThan(poorEval?.allocatedWeight ?? 0);
  });

  it('keeps experimenting and does not converge when pulls are below threshold', () => {
    const arms: BanditArm[] = [
      {
        id: 'arm-1',
        experimentId: 'exp-2',
        hookText: 'Hook 1',
        alphaSuccesses: 5,
        betaFailures: 10,
        pullCount: 15,
        conversionCount: 5,
        trafficWeight: 0.5,
        status: 'ACTIVE',
      },
      {
        id: 'arm-2',
        experimentId: 'exp-2',
        hookText: 'Hook 2',
        alphaSuccesses: 6,
        betaFailures: 9,
        pullCount: 15,
        conversionCount: 6,
        trafficWeight: 0.5,
        status: 'ACTIVE',
      },
    ];

    const result = evaluateBanditExperiment('exp-2', arms, 30, 50, 0.95);
    expect(result.converged).toBe(false);
    expect(result.winningArmId).toBeNull();
  });
});
