/**
 * Unit Tests for UCB1 MAB Hook Optimizer
 *
 * @module tree/affiliate/optimization/__tests__/mab-hook-optimizer.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateUcb1Score,
  selectBestHookArm,
  recordConversionReward,
  type HookArm,
} from '../mab-hook-optimizer';

describe('UCB1 Multi-Armed Bandit Hook Optimizer', () => {
  it('gives infinite score to unpulled arms for pure exploration', () => {
    const unpulledArm: HookArm = {
      id: 'hook_fomo',
      name: 'FOMO Scarcity Hook',
      niche: 'crypto_global',
      impressions: 0,
      totalRewardCents: 0,
    };

    const score = calculateUcb1Score(unpulledArm, 100);
    expect(score).toBe(Number.POSITIVE_INFINITY);
  });

  it('selects unpulled arm first before exploiting established arms', () => {
    const arms: HookArm[] = [
      {
        id: 'hook_roi',
        name: '300% ROI Hook',
        niche: 'saas_global',
        impressions: 50,
        totalRewardCents: 15000, // $150
      },
      {
        id: 'hook_secret',
        name: 'Hidden AI Secret Hook',
        niche: 'saas_global',
        impressions: 0, // new arm
        totalRewardCents: 0,
      },
    ];

    const result = selectBestHookArm(arms);
    expect(result.selectedArmId).toBe('hook_secret');
    expect(result.isExploration).toBe(true);
  });

  it('selects the arm with highest UCB score balancing yield and uncertainty', () => {
    const arms: HookArm[] = [
      {
        id: 'hook_a',
        name: 'High Yield Hook',
        niche: 'saas_global',
        impressions: 100,
        totalRewardCents: 50000, // $500 total, $5 avg
      },
      {
        id: 'hook_b',
        name: 'Moderate Yield Under-Explored Hook',
        niche: 'saas_global',
        impressions: 5,
        totalRewardCents: 2000, // $20 total, $4 avg, high variance exploration bonus
      },
      {
        id: 'hook_c',
        name: 'Low Yield Hook',
        niche: 'saas_global',
        impressions: 120,
        totalRewardCents: 6000, // $60 total, $0.5 avg
      },
    ];

    const result = selectBestHookArm(arms);
    expect(result.selectedArmId).toBe('hook_a');
    expect(result.isExploration).toBe(false);
  });

  it('correctly increments accumulated reward upon postback conversion', () => {
    const arm: HookArm = {
      id: 'hook_test',
      name: 'Test Hook',
      niche: 'crypto_global',
      impressions: 10,
      totalRewardCents: 2500,
    };

    const updated = recordConversionReward(arm, 5000); // +$50 commission
    expect(updated.totalRewardCents).toBe(7500);
    expect(updated.impressions).toBe(10);
  });
});
