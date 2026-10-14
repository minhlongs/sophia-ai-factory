/**
 * Row schema and mapper for Video Analytics Store.
 * @module land/analytics/video-analytics-mapper
 */

import type { VideoAnalyticsSnapshot } from '@/seed/types/video-analytics-types';

export const ANALYTICS_TABLE = 'video_analytics_snapshots';

export interface AnalyticsSnapshotRow {
  id: string;
  job_id: string;
  user_id: string;
  channel_id: string;
  platform: string;
  platform_post_id: string;
  title: string | null;
  views: number;
  watch_time_seconds: number;
  avg_view_duration_seconds: number;
  avg_view_percentage: number;
  three_sec_view_rate: number;
  completion_rate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  hook_score: number;
  retention_score: number;
  revenue_usd: number;
  cost_mcu: number;
  cost_usd: number;
  net_roi_usd: number;
  bandit_status: string | null;
  recorded_at: number;
  created_at: number;
}

export function mapSnapshotRow(r: AnalyticsSnapshotRow): VideoAnalyticsSnapshot {
  return {
    id: r.id,
    jobId: r.job_id,
    userId: r.user_id,
    channelId: r.channel_id,
    platform: r.platform as VideoAnalyticsSnapshot['platform'],
    platformPostId: r.platform_post_id,
    title: r.title ?? undefined,
    views: r.views,
    watchTimeSeconds: r.watch_time_seconds,
    avgViewDurationSeconds: r.avg_view_duration_seconds,
    avgViewPercentage: r.avg_view_percentage,
    threeSecViewRate: r.three_sec_view_rate,
    completionRate: r.completion_rate,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    hookScore: r.hook_score,
    retentionScore: r.retention_score,
    revenueUsd: r.revenue_usd,
    costMcu: r.cost_mcu,
    costUsd: r.cost_usd,
    netRoiUsd: r.net_roi_usd,
    banditStatus: (r.bandit_status as VideoAnalyticsSnapshot['banditStatus']) ?? 'COLD_START',
    recordedAt: r.recorded_at,
    createdAt: r.created_at,
  };
}
