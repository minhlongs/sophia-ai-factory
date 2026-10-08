/**
 * Video Analytics Store — D1 persistence for cross-platform performance snapshots
 * Provides querying, upserting, and rollup aggregations for Video Analytics Cockpit.
 * Layer: land/analytics | LOC: < 200 | Zero :any
 * @module land/analytics/video-analytics-store
 */

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@/seed/db/client';
import type {
  VideoAnalyticsSnapshot,
  ChannelAggregateMetrics,
  AnalyticsQueryFilter,
} from '@/seed/types/video-analytics-types';

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

export async function upsertAnalyticsSnapshot(
  snapshot: Omit<VideoAnalyticsSnapshot, 'id' | 'createdAt'>,
  dbOverride?: D1Database,
): Promise<VideoAnalyticsSnapshot> {
  const db = dbOverride ?? (await getD1());
  if (!db) throw new Error('Database connection unavailable');

  const id = `vas_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  await db.prepare(
    `INSERT INTO ${ANALYTICS_TABLE} (
      id, job_id, user_id, channel_id, platform, platform_post_id, title,
      views, watch_time_seconds, avg_view_duration_seconds, avg_view_percentage,
      three_sec_view_rate, completion_rate, likes, comments, shares, saves,
      hook_score, retention_score, revenue_usd, cost_mcu, cost_usd, net_roi_usd,
      bandit_status, recorded_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, snapshot.jobId, snapshot.userId, snapshot.channelId, snapshot.platform, snapshot.platformPostId,
    snapshot.title ?? null, snapshot.views, snapshot.watchTimeSeconds, snapshot.avgViewDurationSeconds,
    snapshot.avgViewPercentage, snapshot.threeSecViewRate, snapshot.completionRate,
    snapshot.likes, snapshot.comments, snapshot.shares, snapshot.saves,
    snapshot.hookScore, snapshot.retentionScore, snapshot.revenueUsd,
    snapshot.costMcu, snapshot.costUsd, snapshot.netRoiUsd,
    snapshot.banditStatus ?? 'COLD_START', snapshot.recordedAt, now
  ).run();

  return { ...snapshot, id, createdAt: now };
}

export async function listUserAnalyticsSnapshots(
  userId: string,
  filter?: AnalyticsQueryFilter,
  dbOverride?: D1Database,
): Promise<VideoAnalyticsSnapshot[]> {
  const db = dbOverride ?? (await getD1());
  if (!db) return [];

  const clauses = ['user_id = ?'];
  const params: unknown[] = [userId];

  if (filter?.platform) {
    clauses.push('platform = ?');
    params.push(filter.platform);
  }
  if (filter?.channelId) {
    clauses.push('channel_id = ?');
    params.push(filter.channelId);
  }
  if (filter?.startDate) {
    clauses.push('recorded_at >= ?');
    params.push(filter.startDate);
  }
  if (filter?.endDate) {
    clauses.push('recorded_at <= ?');
    params.push(filter.endDate);
  }

  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;
  params.push(limit, offset);

  const query = `SELECT * FROM ${ANALYTICS_TABLE} WHERE ${clauses.join(' AND ')} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`;
  const result = await db.prepare(query).bind(...params).all<AnalyticsSnapshotRow>();

  return (result.results ?? []).map(mapSnapshotRow);
}

export async function getUserAggregateMetrics(
  userId: string,
  dbOverride?: D1Database,
): Promise<ChannelAggregateMetrics> {
  const db = dbOverride ?? (await getD1());
  const fallback: ChannelAggregateMetrics = {
    totalViews: 0, totalRevenueUsd: 0, totalCostUsd: 0, totalNetMarginUsd: 0,
    avgHookScore: 0, avgRetentionScore: 0, roiPercent: 0, publishedCount: 0,
  };
  if (!db) return fallback;

  const row = await db.prepare(
    `SELECT
      COUNT(DISTINCT job_id) as job_count,
      SUM(views) as total_views,
      SUM(revenue_usd) as total_revenue,
      SUM(cost_usd) as total_cost,
      AVG(hook_score) as avg_hook,
      AVG(retention_score) as avg_retention
     FROM ${ANALYTICS_TABLE}
     WHERE user_id = ?`
  ).bind(userId).first<{
    job_count: number; total_views: number; total_revenue: number;
    total_cost: number; avg_hook: number; avg_retention: number;
  }>();

  if (!row || !row.job_count) return fallback;

  const totalRev = Math.round((row.total_revenue ?? 0) * 100) / 100;
  const totalCost = Math.round((row.total_cost ?? 0) * 100) / 100;
  const netMargin = Math.round((totalRev - totalCost) * 100) / 100;
  const roiPct = totalCost > 0 ? Math.round(((totalRev - totalCost) / totalCost) * 1000) / 10 : 0;

  return {
    totalViews: row.total_views ?? 0,
    totalRevenueUsd: totalRev,
    totalCostUsd: totalCost,
    totalNetMarginUsd: netMargin,
    avgHookScore: Math.round((row.avg_hook ?? 0) * 10) / 10,
    avgRetentionScore: Math.round((row.avg_retention ?? 0) * 10) / 10,
    roiPercent: roiPct,
    publishedCount: row.job_count,
  };
}
