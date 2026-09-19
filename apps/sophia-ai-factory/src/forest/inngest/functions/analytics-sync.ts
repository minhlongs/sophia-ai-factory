/**
 * Inngest Cron: Analytics Sync
 * Runs every 12 hours — fetches YouTube analytics for all published videos.
 * Auto-refreshes expired OAuth tokens using platform_credentials.
 *
 * Phase 05: Per-Video Analytics
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getDecryptedCredentials, storeCredentials } from '@/forest/publishing/credential-manager';
import { refreshAccessToken } from '@/land/youtube/youtube-oauth-client';
import { fetchYouTubeAnalytics } from '@/land/analytics/youtube-analytics-fetcher';
import { normalizeYouTubeMetrics } from '@/land/analytics/analytics-normalizer';
import { writeYouTubeRevenueEvents, type RevenueRowInput } from '@/land/analytics/revenue-ingestion';
import { upsertVideoAnalytics } from '@/seed/db/repositories/video-analytics-repo';

interface PublishedVideoRow {
  user_id: string;
  video_id: string;
  platform_video_id: string;
  platform: string;
}

function getDateRange(daysBack = 30): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export const analyticsSync = inngest.createFunction(
  { id: 'analytics-sync', retries: 2 },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    // Fetch all users with published YouTube videos
    const publishedVideos = await step.run('fetch-published-videos', async () => {
      const _db = await getD1();
      if (!_db) throw new Error('D1 database binding not available');
      const db = _db;
      const { results } = await db
        .prepare(
          `SELECT DISTINCT user_id, video_id, platform_video_id, platform
           FROM video_publishes
           WHERE platform = 'youtube'
             AND status = 'published'
             AND platform_video_id IS NOT NULL
           ORDER BY user_id`,
        )
        .all<PublishedVideoRow>();
      return results ?? [];
    });

    if (publishedVideos.length === 0) {
      logger.info('[analytics-sync] No published YouTube videos found');
      return { synced: 0 };
    }

    // Group by user_id
    const byUser = new Map<string, PublishedVideoRow[]>();
    for (const row of publishedVideos) {
      const arr = byUser.get(row.user_id) ?? [];
      arr.push(row);
      byUser.set(row.user_id, arr);
    }

    const dateRange = getDateRange(30);
    let totalSynced = 0;
    let totalRevenueEvents = 0;

    for (const [userId, videos] of byUser.entries()) {
      const userResult = await step.run(`sync-user-${userId}`, async () => {
        // Get and potentially refresh YouTube credentials
        let creds = await getDecryptedCredentials(userId, 'youtube');
        if (!creds) return { count: 0, revenueWritten: 0 };

        // Refresh token if expired
        if (creds.isExpired && creds.refreshToken) {
          try {
            const refreshed = await refreshAccessToken(creds.refreshToken);
            await storeCredentials({
              userId,
              platform: 'youtube',
              accessToken: refreshed.access_token,
              expiresIn: refreshed.expires_in,
            });
            creds = await getDecryptedCredentials(userId, 'youtube');
            if (!creds) return { count: 0, revenueWritten: 0 };
          } catch (err) {
            logger.warn('[analytics-sync] Token refresh failed', { userId, err: String(err) });
            return { count: 0, revenueWritten: 0 };
          }
        }

        const videoIds = videos.map(v => v.platform_video_id);
        let rows;
        try {
          rows = await fetchYouTubeAnalytics(creds.accessToken, videoIds, dateRange);
        } catch (err) {
          logger.warn('[analytics-sync] Fetch failed', { userId, err: String(err) });
          return { count: 0, revenueWritten: 0 };
        }

        // Build lookup map: platform_video_id → video_id
        const vidMap = new Map(videos.map(v => [v.platform_video_id, v.video_id]));

        let count = 0;
        const revenueRows: RevenueRowInput[] = [];
        for (const raw of rows) {
          const normalized = normalizeYouTubeMetrics(raw);
          const videoId = vidMap.get(raw.videoId);
          if (!videoId) continue;
          revenueRows.push({
            videoId,
            date: normalized.date,
            estimatedRevenueCents: normalized.estimatedRevenueCents,
          });

          try {
            await upsertVideoAnalytics({
              userId,
              videoId,
              platform: 'youtube',
              platformVideoId: raw.videoId,
              date: normalized.date,
              views: normalized.views,
              watchTimeSec: normalized.watchTimeSec,
              completionRate: normalized.completionRate,
              impressions: normalized.impressions,
              clicks: normalized.clicks,
              likes: normalized.likes,
              comments: normalized.comments,
              shares: normalized.shares,
            });
            count++;

            // Update publishing_results with latest metrics snapshot
            const _db = await getD1();
            if (_db) {
              await _db
                .prepare(
                  `UPDATE publishing_results
                   SET metrics_json = ?, recorded_at = ?
                   WHERE channel_post_id = ?`,
                )
                .bind(
                  JSON.stringify({
                    views: normalized.views,
                    likes: normalized.likes,
                    comments: normalized.comments,
                    shares: normalized.shares,
                    watch_time_sec: normalized.watchTimeSec,
                    updated_at: Math.floor(Date.now() / 1000),
                  }),
                  Math.floor(Date.now() / 1000),
                  raw.videoId,
                )
                .run()
                .catch(() => {});
            }

            // Record engagement event into performance_events (idempotent)
            const { recordPerformanceEventIdempotent } = await import('@/tree/performance/events');
            await recordPerformanceEventIdempotent({
              id: `pevt_yt_sync_${raw.videoId}_${normalized.date}`,
              workspaceId: userId,
              assetId: videoId,
              projectId: videoId,
              entityType: 'video',
              entityId: raw.videoId,
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
            }).catch(() => {});
          } catch (err) {
            logger.warn('[analytics-sync] Upsert failed', { videoId, err: String(err) });
          }
        }

        // Revenue ingestion — additive, never fails the analytics sync.
        let revenueWritten = 0;
        try {
          const result = await writeYouTubeRevenueEvents({ userId, rows: revenueRows });
          revenueWritten = result.written;
        } catch (err) {
          logger.warn('[analytics-sync] Revenue ingestion failed (non-fatal)', {
            userId,
            err: String(err),
          });
        }

        logger.info('[analytics-sync] User synced', { userId, count, revenueWritten });
        return { count, revenueWritten };
      });

      totalSynced += userResult.count;
      totalRevenueEvents += userResult.revenueWritten;
    }

    // Step 2: Harvest Instagram Reels metrics
    let igHarvested = 0;
    try {
      const igResult = await step.run('harvest-instagram-reels-metrics', async () => {
        const { harvestInstagramReelsMetrics } = await import(
          '@/forest/publishing/instagram-metrics-harvester'
        );
        return harvestInstagramReelsMetrics({ limit: 50 });
      });
      igHarvested = (igResult as { harvested?: number })?.harvested ?? 0;
    } catch (igErr) {
      logger.warn('[analytics-sync] Instagram harvest failed (non-fatal)', {
        err: String(igErr),
      });
    }

    // Step 3: Run feedback loop evaluations & prompt optimizations
    const optimizedCount = await step.run('run-performance-feedback-loop', async () => {
      try {
        const { runPerformanceFeedbackAndOptimization } = await import(
          '@/tree/sop/performance-feedback-engine'
        );
        return await runPerformanceFeedbackAndOptimization();
      } catch (err) {
        logger.error('[analytics-sync] Feedback loop failed (non-fatal)', {
          error: err instanceof Error ? err.message : String(err),
        });
        return 0;
      }
    });

    const summary: {
      synced: number;
      optimizedCount: number;
      revenueEvents: number;
      instagramHarvested?: number;
    } = {
      synced: totalSynced,
      optimizedCount,
      revenueEvents: totalRevenueEvents,
    };
    if (igHarvested > 0) {
      summary.instagramHarvested = igHarvested;
    }

    logger.info('[analytics-sync] Complete', summary);
    return summary;
  },
);

export const instagramReelsHarvestCron = inngest.createFunction(
  { id: 'instagram-reels-harvest-cron', retries: 2 },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    return step.run('harvest-instagram-reels', async () => {
      const { harvestInstagramReelsMetrics } = await import(
        '@/forest/publishing/instagram-metrics-harvester'
      );
      return harvestInstagramReelsMetrics({ limit: 100 });
    });
  },
);
