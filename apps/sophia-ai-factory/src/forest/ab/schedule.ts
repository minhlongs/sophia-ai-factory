/**
 * A/B Thumbnail Schedule — Inngest cron functions
 *
 * Cron schedules for automated A/B experiment lifecycle:
 * - Every 2 hours: create experiments for videos that need them
 * - Evaluation is handled by `ab-winner-picker-cron` (every 6h, already exists)
 *
 * @module forest/ab/schedule
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  findVideosNeedingExperiments,
  createThumbnailAbExperiment,
} from '@/forest/ab/thumbnail-ab-runner';

/**
 * Every 2 hours: discover completed videos without an A/B experiment
 * and create one using the variant-generator.
 *
 * Acts as a safety net for videos that missed the event-driven path
 * (e.g., created before the AB feature was deployed).
 */
export const thumbnailAbCreatorCron = inngest.createFunction(
  { id: 'thumbnail-ab-creator-cron' },
  { cron: '0 */2 * * *' },
  async ({ step }) => {
    const candidates = await step.run('find-videos-needing-experiments', async () => {
      return findVideosNeedingExperiments(20);
    });

    if (candidates.length === 0) {
      logger.info('[thumbnail-ab-creator-cron] No videos needing experiments');
      return { evaluated: 0, created: 0 };
    }

    logger.info(
      '[thumbnail-ab-creator-cron] Found videos needing experiments',
      { count: candidates.length },
    );

    let created = 0;
    for (const video of candidates) {
      const result = await step.run(
        `create-experiment-${video.videoId}`,
        async () => {
          return createThumbnailAbExperiment({
            videoId: video.videoId,
            tenantId: video.tenantId,
            originalCaption: video.title,
          });
        },
      );
      if (result) created++;
    }

    logger.info('[thumbnail-ab-creator-cron] Experiments created', {
      candidates: candidates.length,
      created,
    });

    return { evaluated: candidates.length, created };
  },
);
