import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { AnalyticsSyncSummary, PublishedVideoRow } from './types';
import { getDateRange, groupVideosByUser } from './event-batcher';
import { syncUserAnalytics } from './user-sync-executor';

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
      return (results as unknown as PublishedVideoRow[]) ?? [];
    });

    if (publishedVideos.length === 0) {
      logger.info('[analytics-sync] No published YouTube videos found');
      return { synced: 0 } as AnalyticsSyncSummary;
    }

    // Group by user_id
    const byUser = groupVideosByUser(publishedVideos);
    const dateRange = getDateRange(30);

    let totalSynced = 0;
    let totalRevenueEvents = 0;

    for (const [userId, videos] of byUser.entries()) {
      const userResult = await step.run(`sync-user-${userId}`, async () => {
        return syncUserAnalytics(userId, videos, dateRange);
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

    const summary: AnalyticsSyncSummary = {
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
