/**
 * Unit Tests for Land Video Analytics Store
 *
 * @module land/analytics/__tests__/video-analytics-store.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  upsertAnalyticsSnapshot,
  listUserAnalyticsSnapshots,
  getUserAggregateMetrics,
  mapSnapshotRow,
  type AnalyticsSnapshotRow,
} from '../video-analytics-store';
import type { D1Database } from '@/seed/db/client';

describe('Video Analytics Store', () => {
  it('maps snapshot raw database row to typed domain object correctly', () => {
    const rawRow: AnalyticsSnapshotRow = {
      id: 'vas_1',
      job_id: 'job_100',
      user_id: 'usr_ceo',
      channel_id: 'chn_yt',
      platform: 'YOUTUBE_SHORTS',
      platform_post_id: 'post_yt_100',
      title: 'AI Video Blueprint',
      views: 1200,
      watch_time_seconds: 36000,
      avg_view_duration_seconds: 30,
      avg_view_percentage: 85.5,
      three_sec_view_rate: 0.75,
      completion_rate: 0.45,
      likes: 120,
      comments: 18,
      shares: 24,
      saves: 36,
      hook_score: 82.5,
      retention_score: 79.2,
      revenue_usd: 15.5,
      cost_mcu: 25,
      cost_usd: 0.20,
      net_roi_usd: 15.3,
      bandit_status: 'PROMOTED',
      recorded_at: 1774000000,
      created_at: 1774000100,
    };

    const domain = mapSnapshotRow(rawRow);
    expect(domain.id).toBe('vas_1');
    expect(domain.platform).toBe('YOUTUBE_SHORTS');
    expect(domain.hookScore).toBe(82.5);
    expect(domain.banditStatus).toBe('PROMOTED');
    expect(domain.title).toBe('AI Video Blueprint');
  });

  it('upserts snapshot into mock D1 database', async () => {
    const mockBind = vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({ success: true }),
    });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare } as unknown as D1Database;

    const result = await upsertAnalyticsSnapshot(
      {
        jobId: 'job_200',
        userId: 'usr_ceo',
        channelId: 'chn_tt',
        platform: 'TIKTOK_V2',
        platformPostId: 'post_tt_200',
        views: 5000,
        watchTimeSeconds: 100000,
        avgViewDurationSeconds: 20,
        avgViewPercentage: 90,
        threeSecViewRate: 0.8,
        completionRate: 0.5,
        likes: 400,
        comments: 50,
        shares: 60,
        saves: 80,
        hookScore: 88,
        retentionScore: 84,
        revenueUsd: 25,
        costMcu: 30,
        costUsd: 0.3,
        netRoiUsd: 24.7,
        banditStatus: 'ACTIVE_ARM',
        recordedAt: 1774000500,
      },
      mockDb,
    );

    expect(result.id).toMatch(/^vas_/);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO video_analytics_snapshots'));
    expect(mockBind).toHaveBeenCalled();
  });

  it('lists user analytics snapshots with filters and pagination', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'vas_list_1',
          job_id: 'job_list_1',
          user_id: 'usr_ceo',
          channel_id: 'chn_reels',
          platform: 'INSTAGRAM_REELS',
          platform_post_id: 'ig_1',
          title: null,
          views: 800,
          watch_time_seconds: 16000,
          avg_view_duration_seconds: 20,
          avg_view_percentage: 70,
          three_sec_view_rate: 0.65,
          completion_rate: 0.35,
          likes: 50,
          comments: 5,
          shares: 10,
          saves: 15,
          hook_score: 72,
          retention_score: 68,
          revenue_usd: 5,
          cost_mcu: 10,
          cost_usd: 0.1,
          net_roi_usd: 4.9,
          bandit_status: null,
          recorded_at: 1774000800,
          created_at: 1774000800,
        },
      ],
    });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare } as unknown as D1Database;

    const list = await listUserAnalyticsSnapshots(
      'usr_ceo',
      { platform: 'INSTAGRAM_REELS', limit: 10, offset: 0 },
      mockDb,
    );

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('vas_list_1');
    expect(list[0].banditStatus).toBe('COLD_START');
  });

  it('aggregates channel metrics across all videos for a user', async () => {
    const mockFirst = vi.fn().mockResolvedValue({
      job_count: 5,
      total_views: 25000,
      total_revenue: 120.5,
      total_cost: 2.5,
      avg_hook: 81.4,
      avg_retention: 76.8,
    });
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare } as unknown as D1Database;

    const aggregate = await getUserAggregateMetrics('usr_ceo', mockDb);

    expect(aggregate.publishedCount).toBe(5);
    expect(aggregate.totalViews).toBe(25000);
    expect(aggregate.totalRevenueUsd).toBe(120.5);
    expect(aggregate.totalCostUsd).toBe(2.5);
    expect(aggregate.totalNetMarginUsd).toBe(118);
    expect(aggregate.avgHookScore).toBe(81.4);
    expect(aggregate.avgRetentionScore).toBe(76.8);
    expect(aggregate.roiPercent).toBe(4720); // (120.5 - 2.5) / 2.5 * 100 = 4720%
  });
});
