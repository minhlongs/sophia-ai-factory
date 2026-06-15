/**
 * Inngest Cron: Analytics Sync
 * Runs every 12 hours — fetches YouTube analytics for all published videos.
 * Auto-refreshes expired OAuth tokens using platform_credentials.
 *
 * Phase 05: Per-Video Analytics
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getDecryptedCredentials, storeCredentials } from '@/forest/publishing/credential-manager';
import { refreshAccessToken } from '@/land/youtube/youtube-oauth-client';
import { fetchYouTubeAnalytics } from '@/land/analytics/youtube-analytics-fetcher';
import { normalizeYouTubeMetrics } from '@/land/analytics/analytics-normalizer';
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
      const db = await getD1Raw();
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

    for (const [userId, videos] of byUser.entries()) {
      const synced = await step.run(`sync-user-${userId}`, async () => {
        // Get and potentially refresh YouTube credentials
        let creds = await getDecryptedCredentials(userId, 'youtube');
        if (!creds) return 0;

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
            if (!creds) return 0;
          } catch (err) {
            logger.warn('[analytics-sync] Token refresh failed', { userId, err: String(err) });
            return 0;
          }
        }

        const videoIds = videos.map(v => v.platform_video_id);
        let rows;
        try {
          rows = await fetchYouTubeAnalytics(creds.accessToken, videoIds, dateRange);
        } catch (err) {
          logger.warn('[analytics-sync] Fetch failed', { userId, err: String(err) });
          return 0;
        }

        // Build lookup map: platform_video_id → video_id
        const vidMap = new Map(videos.map(v => [v.platform_video_id, v.video_id]));

        let count = 0;
        for (const raw of rows) {
          const normalized = normalizeYouTubeMetrics(raw);
          const videoId = vidMap.get(raw.videoId);
          if (!videoId) continue;

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
          } catch (err) {
            logger.warn('[analytics-sync] Upsert failed', { videoId, err: String(err) });
          }
        }

        logger.info('[analytics-sync] User synced', { userId, count });
        return count;
      });

      totalSynced += synced;
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

    logger.info('[analytics-sync] Complete', { totalSynced, optimizedCount });
    return { synced: totalSynced, optimizedCount };
  },
);
