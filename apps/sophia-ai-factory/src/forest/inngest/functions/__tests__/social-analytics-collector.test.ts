/**
 * Unit Tests for Social Analytics Collector Inngest Job
 *
 * @module forest/inngest/functions/__tests__/social-analytics-collector.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  processSocialAnalyticsCollector,
  fetchMockPlatformMetrics,
} from '../social-analytics-collector';

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn().mockResolvedValue(true),
  recordSuccess: vi.fn().mockResolvedValue(undefined),
  recordFailure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/land/analytics/video-analytics-store', () => ({
  upsertAnalyticsSnapshot: vi.fn().mockResolvedValue({
    id: 'vas_mock_123',
    jobId: 'job_456',
    hookScore: 82,
    retentionScore: 78,
  }),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_123'] }),
    createFunction: vi.fn(),
  },
}));

describe('Social Analytics Collector Inngest Job', () => {
  it('fetches platform metrics under circuit breaker protection', async () => {
    const metrics = await fetchMockPlatformMetrics('YOUTUBE_SHORTS', 'post_123');
    expect(metrics.views).toBeGreaterThan(0);
    expect(metrics.watchTimeSeconds).toBeGreaterThan(0);
    expect(metrics.avgViewPercentage).toBeGreaterThan(0);
  });

  it('executes multi-step collection, normalization, attribution, and feedback dispatch', async () => {
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
      sleep: vi.fn(),
    };

    const result = await processSocialAnalyticsCollector({
      event: {
        data: {
          userId: 'usr_collector_test',
          jobId: 'job_collector_test',
          channelId: 'chn_1',
          platform: 'TIKTOK_V2',
          platformPostId: 'tt_post_999',
          title: 'High Converting Affiliate Video',
          mcuCost: 15,
          byokCostUsd: 0.03,
          revenueUsd: 2.5,
        },
      },
      step: mockStep,
    });

    expect(result.synced).toBe(true);
    expect(result.snapshotId).toBe('vas_mock_123');
    expect(result.hookScore).toBeGreaterThan(0);
    expect(mockStep.run).toHaveBeenCalledWith('fetch-platform-metrics', expect.any(Function));
    expect(mockStep.run).toHaveBeenCalledWith('normalize-metrics', expect.any(Function));
    expect(mockStep.run).toHaveBeenCalledWith('calculate-attribution', expect.any(Function));
    expect(mockStep.run).toHaveBeenCalledWith('persist-snapshot', expect.any(Function));
    expect(mockStep.run).toHaveBeenCalledWith('dispatch-flywheel-feedback', expect.any(Function));
  });
});
