import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { upsertVideoAnalytics } from '@/seed/db/repositories/video-analytics-repo';
import { recordPerformanceEventIdempotent } from '@/tree/performance/events';
import { InstagramReelsMetrics, InstagramPostRow } from './types';

export async function persistHarvestedMetrics(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  post: InstagramPostRow,
  metrics: InstagramReelsMetrics,
  today: string,
  nowSec: number,
): Promise<void> {
  // 1. Update publishing_results.metrics_json
  const metricsPayload = {
    views: metrics.views,
    reach: metrics.reach ?? 0,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares ?? 0,
    updated_at: nowSec,
  };

  await db
    .prepare(
      `UPDATE publishing_results
       SET metrics_json = ?, recorded_at = ?
       WHERE channel_post_id = ?`,
    )
    .bind(JSON.stringify(metricsPayload), nowSec, post.channel_post_id)
    .run()
    .catch(() => {});

  // 2. Upsert into video_analytics
  if (post.video_id) {
    await upsertVideoAnalytics({
      userId: post.tenant_id,
      videoId: post.video_id,
      platform: 'instagram',
      platformVideoId: post.channel_post_id,
      date: today,
      views: metrics.views,
      impressions: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares ?? 0,
    }).catch((err) => {
      logger.warn('[instagram-metrics-harvester] video_analytics upsert error', {
        videoId: post.video_id,
        err: String(err),
      });
    });
  }

  // 3. Record into performance_events (idempotent)
  await recordPerformanceEventIdempotent({
    id: `pevt_ig_${post.channel_post_id}_${today}`,
    workspaceId: post.tenant_id,
    assetId: post.video_id || post.channel_post_id,
    projectId: post.video_id || post.channel_post_id,
    entityType: 'video',
    entityId: post.channel_post_id,
    channel: 'instagram',
    eventType: 'engagement',
    count: metrics.views,
    valueCents: 0,
    recordedAt: Date.now(),
    rawData: {
      views: metrics.views,
      reach: metrics.reach ?? 0,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares ?? 0,
      source: 'instagram-harvester',
    },
  }).catch((err) => {
    logger.warn('[instagram-metrics-harvester] performance_events write failed', {
      postId: post.channel_post_id,
      err: String(err),
    });
  });
}
