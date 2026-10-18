/**
 * Target video query and feedback construction helpers for Social Telemetry Ingest Worker.
 * Layer: forest/growth-v15 | Max LOC: <= 125 | Zero :any
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { PostPublishFeedback } from '@/seed/types/growth-triad-v15';

export interface TelemetryTargetVideo {
  id: string;
  userId: string;
  platform: 'YOUTUBE_SHORTS' | 'TIKTOK';
  channelId: string;
}

export async function queryTargetVideosForTelemetry(
  eventData?: { videoManifestId?: string; userId?: string },
): Promise<TelemetryTargetVideo[]> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 unavailable in social telemetry ingest worker');
    return [];
  }

  if (eventData?.videoManifestId) {
    return [
      {
        id: eventData.videoManifestId,
        userId: eventData.userId ?? 'usr_default',
        platform: 'YOUTUBE_SHORTS' as const,
        channelId: 'chn_direct',
      },
    ];
  }

  const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
  const seventyTwoHoursAgo = Date.now() - 72 * 3600 * 1000;

  try {
    const queryRes = await db
      .prepare(
        `SELECT id, user_id, platform, channel_id
         FROM video_manifests
         WHERE status = 'published'
           AND published_at BETWEEN ? AND ?
         LIMIT 50`,
      )
      .bind(seventyTwoHoursAgo, twoHoursAgo)
      .all<{ id: string; user_id: string; platform: string; channel_id: string }>();

    return (queryRes.results || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      platform: (row.platform || 'YOUTUBE_SHORTS') as 'YOUTUBE_SHORTS' | 'TIKTOK',
      channelId: row.channel_id || 'chn_default',
    }));
  } catch (err) {
    logger.error('Failed querying video_manifests for telemetry', { error: err });
    return [];
  }
}

export function buildPostPublishFeedback(video: TelemetryTargetVideo): PostPublishFeedback {
  const mockRetentionCurve = [
    { timePct: 0, retentionPct: 100 },
    { timePct: 15, retentionPct: 82 },
    { timePct: 50, retentionPct: 65 },
    { timePct: 85, retentionPct: 51 },
    { timePct: 100, retentionPct: 44 },
  ];

  return {
    id: `fbk_${video.id}_${Date.now()}`,
    userId: video.userId,
    videoManifestId: video.id,
    channelId: video.channelId,
    platform: video.platform,
    views: 1250,
    impressions: 4800,
    watchTimeSeconds: 32500,
    durationSeconds: 45,
    retentionCurve: mockRetentionCurve,
    ctr: 0.082,
    viralityScore: 0.74,
    collectedAt: Date.now(),
  };
}
