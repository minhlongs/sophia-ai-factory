/**
 * Types for video analytics repository.
 * @module seed/db/repositories/video-analytics-types
 */

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
