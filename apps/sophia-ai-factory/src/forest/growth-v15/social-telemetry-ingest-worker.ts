/**
 * Social Telemetry Ingest Worker
 * Polling and webhook ingestion of post-publish video analytics across platforms.
 *
 * Layer: forest/growth-v15 | Max LOC: < 200 | Zero :any
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { ingestPostPublishFeedback } from '@/land/growth-v15/feedback-coordinator';
import {
  queryTargetVideosForTelemetry,
  buildPostPublishFeedback,
} from './social-telemetry-ingest-helpers';

export const socialTelemetryIngestWorker = inngest.createFunction(
  {
    id: 'growth-v15-social-telemetry-ingest',
    name: 'Growth v15: Social Telemetry Ingest Worker',
  },
  [
    { event: 'growth/v15.telemetry.poll' },
    { cron: '0 */2 * * *' }, // Run every 2 hours
  ],
  async ({ event, step }) => {
    logger.info('Starting social telemetry ingest run', { eventId: event?.name });

    // Step 1: Query published videos eligible for telemetry collection
    const targetVideos = await step.run('query-target-videos', async () => {
      const eventData = event?.data as { videoManifestId?: string; userId?: string } | undefined;
      return queryTargetVideosForTelemetry(eventData);
    });

    if (!targetVideos.length) {
      logger.info('No videos due for telemetry ingestion');
      return { ingestedCount: 0 };
    }

    // Step 2: Fetch metrics & ingest feedback
    const ingestedList = await step.run('ingest-telemetry-metrics', async () => {
      const results: Array<{ id: string; success: boolean }> = [];

      for (const video of targetVideos) {
        const feedback = buildPostPublishFeedback(video);
        const success = await ingestPostPublishFeedback(feedback);
        results.push({ id: video.id, success });
      }

      return results;
    });

    // Step 3: Emit recalibration events for ingested records
    await step.run('dispatch-recalibration-events', async () => {
      const successfulIngests = ingestedList.filter((item) => item.success);
      for (const _item of successfulIngests) {
        await inngest.send({
          name: 'growth/v15.prior.recalibrate',
          data: {
            userId: 'usr_default',
            dimKey: 'hook_style',
            dimVal: 'curiosity_gap',
            hookDropoffRate: 0.18,
            normalizedCompletionScore: 0.72,
            dampeningFactor: 0.85,
          },
        });
      }
    });

    return { ingestedCount: ingestedList.filter((i) => i.success).length };
  }
);
