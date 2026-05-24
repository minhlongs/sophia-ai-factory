/**
 * Video analytics repository — per-video daily snapshot store.
 * Supports upsert of daily metrics and range queries.
 *
 * @module seed/db/repositories/video-analytics-repo
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface VideoAnalyticsRow {
  id: string;
  user_id: string;
  video_id: string;
  platform: string;
  platform_video_id: string;
  date: string;
  views: number;
  watch_time_sec: number;
  completion_rate: number;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  synced_at: string;
}

export interface UpsertVideoAnalyticsInput {
  userId: string;
  videoId: string;
  platform: string;
  platformVideoId: string;
  date: string;
  views?: number;
  watchTimeSec?: number;
  completionRate?: number;
  impressions?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalWatchTimeSec: number;
  totalImpressions: number;
  totalClicks: number;
  totalLikes: number;
  avgCompletionRate: number;
  avgCtr: number;
}

export async function upsertVideoAnalytics(data: UpsertVideoAnalyticsInput): Promise<void> {
  const db = await getD1Raw();
  await db
    .prepare(
      `INSERT INTO video_analytics
         (user_id, video_id, platform, platform_video_id, date,
          views, watch_time_sec, completion_rate, impressions,
          clicks, likes, comments, shares, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(video_id, platform, date)
       DO UPDATE SET
         views = excluded.views,
         watch_time_sec = excluded.watch_time_sec,
         completion_rate = excluded.completion_rate,
         impressions = excluded.impressions,
         clicks = excluded.clicks,
         likes = excluded.likes,
         comments = excluded.comments,
         shares = excluded.shares,
         synced_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      data.userId, data.videoId, data.platform, data.platformVideoId, data.date,
      data.views ?? 0, data.watchTimeSec ?? 0, data.completionRate ?? 0,
      data.impressions ?? 0, data.clicks ?? 0,
      data.likes ?? 0, data.comments ?? 0, data.shares ?? 0,
    )
    .run();

  logger.info('[video-analytics-repo] Upserted', { videoId: data.videoId, date: data.date });
}

export async function getVideoAnalytics(
  userId: string,
  videoId: string,
  platform?: string,
  dateRange?: DateRange,
): Promise<VideoAnalyticsRow[]> {
  const db = await getD1Raw();
  let sql = 'SELECT * FROM video_analytics WHERE user_id = ? AND video_id = ?';
  const params: unknown[] = [userId, videoId];

  if (platform) { sql += ' AND platform = ?'; params.push(platform); }
  if (dateRange) {
    sql += ' AND date >= ? AND date <= ?';
    params.push(dateRange.start, dateRange.end);
  }
  sql += ' ORDER BY date ASC';

  const { results } = await db.prepare(sql).bind(...params).all<VideoAnalyticsRow>();
  return results ?? [];
}

export async function getTopVideos(
  userId: string,
  metric: 'views' | 'ctr' | 'watch_time',
  limit: number,
  dateRange?: DateRange,
): Promise<{ videoId: string; platformVideoId: string; platform: string; total: number }[]> {
  const db = await getD1Raw();
  const col = metric === 'ctr'
    ? 'CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) ELSE 0 END'
    : metric === 'watch_time' ? 'SUM(watch_time_sec)' : 'SUM(views)';

  let sql = `SELECT video_id, platform_video_id, platform, (${col}) AS total
             FROM video_analytics WHERE user_id = ?`;
  const params: unknown[] = [userId];

  if (dateRange) {
    sql += ' AND date >= ? AND date <= ?';
    params.push(dateRange.start, dateRange.end);
  }
  sql += ' GROUP BY video_id, platform ORDER BY total DESC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(sql).bind(...params).all<{
    video_id: string; platform_video_id: string; platform: string; total: number;
  }>();
  return (results ?? []).map(r => ({
    videoId: r.video_id, platformVideoId: r.platform_video_id,
    platform: r.platform, total: r.total,
  }));
}

export async function getAnalyticsSummary(userId: string, dateRange: DateRange): Promise<AnalyticsSummary> {
  const db = await getD1Raw();
  const row = await db
    .prepare(
      `SELECT SUM(views) AS totalViews, SUM(watch_time_sec) AS totalWatchTimeSec,
              SUM(impressions) AS totalImpressions, SUM(clicks) AS totalClicks,
              SUM(likes) AS totalLikes, AVG(completion_rate) AS avgCompletionRate,
              CASE WHEN SUM(impressions) > 0 THEN CAST(SUM(clicks) AS REAL) / SUM(impressions) ELSE 0 END AS avgCtr
       FROM video_analytics WHERE user_id = ? AND date >= ? AND date <= ?`,
    )
    .bind(userId, dateRange.start, dateRange.end)
    .first<{
      totalViews: number; totalWatchTimeSec: number; totalImpressions: number;
      totalClicks: number; totalLikes: number; avgCompletionRate: number; avgCtr: number;
    }>();

  return {
    totalViews: row?.totalViews ?? 0,
    totalWatchTimeSec: row?.totalWatchTimeSec ?? 0,
    totalImpressions: row?.totalImpressions ?? 0,
    totalClicks: row?.totalClicks ?? 0,
    totalLikes: row?.totalLikes ?? 0,
    avgCompletionRate: row?.avgCompletionRate ?? 0,
    avgCtr: row?.avgCtr ?? 0,
  };
}
