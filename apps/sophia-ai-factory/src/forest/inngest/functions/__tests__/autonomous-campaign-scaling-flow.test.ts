import { describe, it, expect, vi } from 'vitest';
import {
  processAutonomousScaling,
} from '../autonomous-campaign-scaling-flow';
import type { CampaignPerformanceMetrics } from '@/tree/affiliate/scaling/auto-campaign-scaler';

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_test'] }),
    createFunction: vi.fn().mockImplementation((config, trigger, handler) => ({
      config,
      trigger,
      handler,
    })),
  },
}));

describe('Autonomous Campaign Scaling Inngest Flow', () => {
  const winnerMetrics: CampaignPerformanceMetrics = {
    campaignId: 'camp_scale_1',
    hookName: 'AI video converts 10x higher',
    niche: 'saas_global',
    impressions: 5000,
    clicks: 400, // 8% CTR
    conversions: 20, // 5% CVR
    totalEarningsCents: 40000, // EPC = 100 cents
    publishedVideosCount: 2,
  };

  const loserMetrics: CampaignPerformanceMetrics = {
    campaignId: 'camp_scale_2',
    hookName: 'Generic product video',
    niche: 'saas_global',
    impressions: 2000,
    clicks: 60,
    conversions: 0,
    totalEarningsCents: 0,
    publishedVideosCount: 3,
  };

  it('correctly processes winners, losers, and triggers scaling actions', async () => {
    const report = await processAutonomousScaling('tenant_test_123', [
      winnerMetrics,
      loserMetrics,
    ]);

    expect(report.totalEvaluated).toBe(2);
    expect(report.scaledCount).toBe(1);
    expect(report.prunedCount).toBe(1);
    expect(report.maintainedCount).toBe(0);

    const winnerDecision = report.decisions.find(
      (d) => d.campaignId === 'camp_scale_1',
    );
    expect(winnerDecision?.action).toBe('SCALE_AGGRESSIVE');
    expect(winnerDecision?.recommendedDailyVideos).toBe(4);

    const loserDecision = report.decisions.find(
      (d) => d.campaignId === 'camp_scale_2',
    );
    expect(loserDecision?.action).toBe('KILL_PRUNE');
    expect(loserDecision?.recommendedDailyVideos).toBe(0);
  });
});
