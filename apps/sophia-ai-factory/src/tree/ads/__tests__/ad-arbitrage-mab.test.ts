/**
 * @file ad-arbitrage-mab.test.ts
 * @description Unit tests for Ad Arbitrage MAB & CPA Stop-Loss
 */

import { describe, it, expect } from 'vitest';
import { evaluateCampaignArbitrage } from '../ad-arbitrage-mab';

describe('Ad Arbitrage MAB (Tree Layer)', () => {
  it('triggers PAUSE_STOP_LOSS when CPA exceeds commission threshold', () => {
    const res = evaluateCampaignArbitrage({
      campaignId: 'camp-1',
      dailyBudget: 1000000,
      spend24h: 600000,
      gmv24h: 300000,
      clicks24h: 200,
      conversions24h: 1,
      commissionPerConversion: 200000, // CPA = 600k > 200k * 1.15
    });

    expect(res.action).toBe('PAUSE_STOP_LOSS');
    expect(res.newDailyBudget).toBe(0);
    expect(res.reason).toContain('Emergency stop-loss triggered');
  });

  it('triggers SCALE_BUDGET when campaign is highly profitable', () => {
    const res = evaluateCampaignArbitrage({
      campaignId: 'camp-win',
      dailyBudget: 1000000,
      spend24h: 800000,
      gmv24h: 2800000, // ROAS = 3.5x >= 2.5x
      clicks24h: 500,
      conversions24h: 8, // CPA = 100k < 200k * 0.7
      commissionPerConversion: 200000,
    });

    expect(res.action).toBe('SCALE_BUDGET');
    expect(res.newDailyBudget).toBe(1250000); // 1.25x
    expect(res.roas).toBeCloseTo(3.5, 2);
  });

  it('triggers REDUCE_BUDGET when campaign underperforms', () => {
    const res = evaluateCampaignArbitrage({
      campaignId: 'camp-low',
      dailyBudget: 1000000,
      spend24h: 500000,
      gmv24h: 550000, // ROAS = 1.1x < 1.2x
      clicks24h: 250,
      conversions24h: 3,
      commissionPerConversion: 200000,
    });

    expect(res.action).toBe('REDUCE_BUDGET');
    expect(res.newDailyBudget).toBe(700000); // -30%
  });

  it('maintains budget when performance is steady', () => {
    const res = evaluateCampaignArbitrage({
      campaignId: 'camp-steady',
      dailyBudget: 1000000,
      spend24h: 500000,
      gmv24h: 950000, // ROAS = 1.9x
      clicks24h: 250,
      conversions24h: 3,
      commissionPerConversion: 200000, // CPA = 166k <= 230k
    });

    expect(res.action).toBe('MAINTAIN');
    expect(res.newDailyBudget).toBe(1000000);
  });
});
