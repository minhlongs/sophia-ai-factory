import { describe, it, expect } from 'vitest';
import {
  evaluateCampaignScaling,
  type CampaignPerformanceMetrics,
} from '../auto-campaign-scaler';

describe('Auto Campaign Scaler & Frequency Manager', () => {
  it('identifies winning hooks and triggers aggressive scaling', () => {
    const winnerMetrics: CampaignPerformanceMetrics = {
      campaignId: 'camp_win_1',
      hookName: 'AI replaces Developers in 2026',
      niche: 'saas_global',
      impressions: 10000,
      clicks: 800, // 8% CTR
      conversions: 40, // 5% CVR
      totalEarningsCents: 80000, // EPC = 100 cents = $1.00
      publishedVideosCount: 2,
    };

    const decision = evaluateCampaignScaling(winnerMetrics);

    expect(decision.action).toBe('SCALE_AGGRESSIVE');
    expect(decision.recommendedDailyVideos).toBe(4);
    expect(decision.ctrPercent).toBe(8);
    expect(decision.cvrPercent).toBe(5);
  });

  it('prunes poor performing hooks with no conversions', () => {
    const loserMetrics: CampaignPerformanceMetrics = {
      campaignId: 'camp_lose_1',
      hookName: 'Boring Product Announcement',
      niche: 'ecommerce_tiktok',
      impressions: 2000,
      clicks: 60, // 60 clicks
      conversions: 0, // 0 conversions
      totalEarningsCents: 0,
      publishedVideosCount: 5,
    };

    const decision = evaluateCampaignScaling(loserMetrics);

    expect(decision.action).toBe('KILL_PRUNE');
    expect(decision.recommendedDailyVideos).toBe(0);
    expect(decision.reason).toContain('Hiệu quả kém');
  });

  it('maintains steady pace when sample size is low', () => {
    const lowSampleMetrics: CampaignPerformanceMetrics = {
      campaignId: 'camp_new_1',
      hookName: 'New Angle Test',
      niche: 'crypto_global',
      impressions: 50,
      clicks: 2,
      conversions: 0,
      totalEarningsCents: 0,
      publishedVideosCount: 1,
    };

    const decision = evaluateCampaignScaling(lowSampleMetrics);

    expect(decision.action).toBe('MAINTAIN_STEADY');
    expect(decision.recommendedDailyVideos).toBe(1);
    expect(decision.reason).toContain('Sample size < 100');
  });
});
