import { describe, it, expect } from 'vitest';
import {
  sampleGamma,
  sampleBeta,
  selectHookWithThompsonSampling,
  recordThompsonFeedback,
  type ThompsonHookArm,
} from '../thompson-sampling-optimizer';

describe('Thompson Sampling Multi-Armed Bandit Optimizer', () => {
  it('samples valid Gamma variates', () => {
    for (let i = 0; i < 20; i++) {
      const val = sampleGamma(2, 1);
      expect(val).toBeGreaterThan(0);
    }
    // Test shape < 1
    for (let i = 0; i < 20; i++) {
      const valSmall = sampleGamma(0.5, 1);
      expect(valSmall).toBeGreaterThan(0);
    }
  });

  it('samples valid Beta variates bounded in [0, 1]', () => {
    for (let i = 0; i < 50; i++) {
      const betaVal = sampleBeta(2, 5);
      expect(betaVal).toBeGreaterThanOrEqual(0);
      expect(betaVal).toBeLessThanOrEqual(1);
    }
  });

  it('throws error when sampling Beta with non-positive parameters', () => {
    expect(() => sampleBeta(0, 5)).toThrow();
    expect(() => sampleBeta(5, -1)).toThrow();
  });

  it('throws error when selecting from empty arms list', () => {
    expect(() => selectHookWithThompsonSampling([])).toThrow();
  });

  it('selects best performing arm with high statistical significance over multiple trials', () => {
    const arms: ThompsonHookArm[] = [
      {
        id: 'hook_poor',
        name: 'Generic Feature List',
        niche: 'saas_global',
        impressions: 1000,
        conversions: 10, // 1% CVR
        totalRewardCents: 5000,
      },
      {
        id: 'hook_star',
        name: 'Extreme Pain Point + Secret Hack',
        niche: 'saas_global',
        impressions: 1000,
        conversions: 200, // 20% CVR
        totalRewardCents: 100000,
      },
    ];

    let starPicks = 0;
    const trials = 100;

    for (let i = 0; i < trials; i++) {
      const result = selectHookWithThompsonSampling(arms);
      if (result.selectedArmId === 'hook_star') {
        starPicks++;
      }
    }

    // Due to 20% vs 1% CVR, hook_star should win almost 100% of the time
    expect(starPicks).toBeGreaterThan(90);
  });

  it('properly updates feedback metrics on conversion postback', () => {
    const initialArm: ThompsonHookArm = {
      id: 'hook_1',
      name: 'Curiosity Gap Hook',
      niche: 'ecommerce_tiktok',
      impressions: 50,
      conversions: 2,
      totalRewardCents: 1200,
    };

    const updated = recordThompsonFeedback(initialArm, 1, 600);
    expect(updated.conversions).toBe(3);
    expect(updated.totalRewardCents).toBe(1800);
  });
});
