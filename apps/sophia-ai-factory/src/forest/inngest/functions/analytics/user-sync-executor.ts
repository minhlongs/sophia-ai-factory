import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getDecryptedCredentials, storeCredentials } from '@/forest/publishing/credential-manager';
import { refreshAccessToken } from '@/land/youtube/youtube-oauth-client';
import { fetchYouTubeAnalytics } from '@/land/analytics/youtube-analytics-fetcher';
import { normalizeYouTubeMetrics } from '@/land/analytics/analytics-normalizer';
import { writeYouTubeRevenueEvents, type RevenueRowInput } from '@/land/analytics/revenue-ingestion';
import { upsertVideoAnalytics } from '@/seed/db/repositories/video-analytics-repo';
import type { DateRange, PublishedVideoRow, UserSyncResult } from './types';
import { createPlatformToVideoMap } from './event-batcher';
import { buildPerformanceEventPayload, buildPublishingMetricsJson } from './rollup-calculator';

export async function syncUserAnalytics(
  userId: string,
  videos: PublishedVideoRow[],
  dateRange: DateRange,
): Promise<UserSyncResult> {
  let creds = await getDecryptedCredentials(userId, 'youtube');
  if (!creds) return { count: 0, revenueWritten: 0 };

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

  const videoIds = videos.map((v) => v.platform_video_id);
  let rows;
  try {
    rows = await fetchYouTubeAnalytics(creds.accessToken, videoIds, dateRange);
  } catch (err) {
    logger.warn('[analytics-sync] Fetch failed', { userId, err: String(err) });
    return { count: 0, revenueWritten: 0 };
  }

  const vidMap = createPlatformToVideoMap(videos);
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

      const _db = await getD1();
      if (_db) {
        await _db
          .prepare(
            `UPDATE publishing_results
             SET metrics_json = ?, recorded_at = ?
             WHERE channel_post_id = ?`,
          )
          .bind(
            buildPublishingMetricsJson(normalized),
            Math.floor(Date.now() / 1000),
            raw.videoId,
          )
          .run()
          .catch(() => {});
      }

      const { recordPerformanceEventIdempotent } = await import('@/tree/performance/events');
      await recordPerformanceEventIdempotent(
        buildPerformanceEventPayload(userId, videoId, raw.videoId, normalized),
      ).catch(() => {});
    } catch (err) {
      logger.warn('[analytics-sync] Upsert failed', { videoId, err: String(err) });
    }
  }

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
}
