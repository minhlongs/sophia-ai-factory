import type { NormalizedMetrics } from '@/land/analytics/analytics-normalizer';

export interface PerformanceEventPayload {
  id: string;
  workspaceId: string;
  assetId: string;
  projectId: string;
  entityType: string;
  entityId: string;
  channel: string;
  eventType: string;
  count: number;
  valueCents: number;
  recordedAt: number;
  rawData: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    watchTimeSec: number;
    date: string;
  };
}

export function buildPerformanceEventPayload(
  userId: string,
  videoId: string,
  platformVideoId: string,
  normalized: NormalizedMetrics,
): PerformanceEventPayload {
  return {
    id: `pevt_yt_sync_${platformVideoId}_${normalized.date}`,
    workspaceId: userId,
    assetId: videoId,
    projectId: videoId,
    entityType: 'video',
    entityId: platformVideoId,
    channel: 'youtube',
    eventType: 'engagement',
    count: normalized.views,
    valueCents: 0,
    recordedAt: Date.now(),
    rawData: {
      views: normalized.views,
      likes: normalized.likes,
      comments: normalized.comments,
      shares: normalized.shares,
      watchTimeSec: normalized.watchTimeSec,
      date: normalized.date,
    },
  };
}

export function buildPublishingMetricsJson(
  normalized: NormalizedMetrics,
): string {
  return JSON.stringify({
    views: normalized.views,
    likes: normalized.likes,
    comments: normalized.comments,
    shares: normalized.shares,
    watch_time_sec: normalized.watchTimeSec,
    updated_at: Math.floor(Date.now() / 1000),
  });
}
