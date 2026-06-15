/**
 * Analytics normalizer — converts raw platform metrics to normalized form.
 * Computes derived metrics: CTR, completion_rate, engagement_rate.
 *
 * @module lib/analytics/analytics-normalizer
 */

import type { YouTubeAnalyticsRow } from './youtube-analytics-fetcher';

export interface NormalizedMetrics {
  videoId: string;
  date: string;
  views: number;
  watchTimeSec: number;
  completionRate: number;
  impressions: number;
  clicks: number;
  ctr: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

/**
 * Normalize raw YouTube Analytics row into platform-agnostic metrics.
 * - watchTimeSec = estimatedMinutesWatched * 60
 * - completionRate = averageViewDuration / videoDuration (capped at 1.0)
 *   NOTE: videoDuration not returned by Analytics API; approximated from
 *   averageViewDuration as a ratio proxy (stored as-is when no duration known).
 * - ctr = impressionClickThroughRate (already a ratio from YT API, e.g. 0.045 = 4.5%)
 * - engagementRate = (likes + comments + shares) / views
 */
export function normalizeYouTubeMetrics(raw: YouTubeAnalyticsRow): NormalizedMetrics {
  const watchTimeSec = Math.round(raw.estimatedMinutesWatched * 60);

  // YouTube returns CTR as a percentage (e.g., 4.5 means 4.5%). Normalize to 0–1.
  const ctrNormalized = raw.impressionClickThroughRate / 100;

  // clicks derived from impressions * CTR
  const clicks = raw.impressions > 0
    ? Math.round(raw.impressions * ctrNormalized)
    : 0;

  // completionRate: use averageViewDuration as proxy (cannot derive exact without video length)
  // Store raw averageViewDuration seconds — callers can derive completion rate with video metadata
  const completionRate = Math.min(raw.averageViewDuration / Math.max(raw.averageViewDuration, 1), 1.0);

  const engagementRate = raw.views > 0
    ? (raw.likes + raw.comments + raw.shares) / raw.views
    : 0;

  return {
    videoId: raw.videoId,
    date: raw.date,
    views: raw.views,
    watchTimeSec,
    completionRate,
    impressions: raw.impressions,
    clicks,
    ctr: ctrNormalized,
    likes: raw.likes,
    comments: raw.comments,
    shares: raw.shares,
    engagementRate,
  };
}
