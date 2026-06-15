/**
 * YouTube Analytics API fetcher.
 * Fetches per-video daily metrics via YouTube Analytics Reporting API v2.
 *
 * @module lib/analytics/youtube-analytics-fetcher
 */

import { logger } from '@/seed/utils/logger-utility';

const YT_ANALYTICS_URL = 'https://youtubeanalytics.googleapis.com/v2/reports';

export interface YouTubeAnalyticsRow {
  videoId: string;
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  impressions: number;
  impressionClickThroughRate: number;
  likes: number;
  comments: number;
  shares: number;
}

interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface YtApiRow {
  dimensions?: string[];
  metrics?: number[];
}

const METRICS = [
  'views',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'impressions',
  'impressionClickThroughRate',
  'likes',
  'comments',
  'shares',
].join(',');

/**
 * Fetch YouTube analytics for given video IDs over date range.
 * Returns one row per (videoId, date) combination.
 */
export async function fetchYouTubeAnalytics(
  accessToken: string,
  videoIds: string[],
  dateRange: DateRange,
): Promise<YouTubeAnalyticsRow[]> {
  if (videoIds.length === 0) return [];

  const filters = `video==${videoIds.join(',')}`;
  const url = new URL(YT_ANALYTICS_URL);
  url.searchParams.set('ids', 'channel==MINE');
  url.searchParams.set('startDate', dateRange.start);
  url.searchParams.set('endDate', dateRange.end);
  url.searchParams.set('metrics', METRICS);
  url.searchParams.set('dimensions', 'video,day');
  url.searchParams.set('filters', filters);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    logger.warn('[youtube-analytics-fetcher] API error', { status: res.status, body: body.slice(0, 200) });
    throw new Error(`YouTube Analytics API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json() as {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<[string, string, ...number[]]>;
  };

  if (!json.rows || json.rows.length === 0) return [];

  // columnHeaders order: video, day, views, estimatedMinutesWatched,
  // averageViewDuration, impressions, impressionClickThroughRate,
  // likes, comments, shares
  return json.rows.map((row) => ({
    videoId: row[0],
    date: row[1],
    views: row[2] ?? 0,
    estimatedMinutesWatched: row[3] ?? 0,
    averageViewDuration: row[4] ?? 0,
    impressions: row[5] ?? 0,
    impressionClickThroughRate: row[6] ?? 0,
    likes: row[7] ?? 0,
    comments: row[8] ?? 0,
    shares: row[9] ?? 0,
  }));
}
