/**
 * Inngest Function: videoPublish
 *
 * Listens: video.uploaded
 * Transition: uploaded → published
 *
 * Phase 10: When video reaches 'uploaded', checks tenant's auto-publish config.
 * If auto-publish channels exist, creates publishing_jobs for each and dispatches
 * publish.scheduled events. If no auto-publish config, simply marks video published.
 *
 * Idempotent: safe to retry.
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';
import type { PublishingChannel } from '@/lib/publishing/publisher-interface';
import { randomUUID } from 'crypto';
import { logger } from '@/seed/utils/logger-utility';

interface VideoJobRow {
  status: VideoJobStatus;
  prompt?: string;
  final_r2_key?: string | null;
}

interface AutoPublishConfig {
  channel_id: string;
  caption_template: string | null;
  hashtags_json: string | null;
  product_link: string | null;
}

export const videoPublish = inngest.createFunction(
  { id: 'video-publish', retries: 3 },
  { event: 'video.uploaded' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    await step.run('transition-to-published', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoPublish] Job not found: ${jobId}`);

      assertValidTransition(row.status, 'published');
      await db
        .from('video_jobs')
        .update({ status: 'published', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'published', provider: 'internal', units: 0, costUsd: 0 });
    });

    // Check for auto-publish config and create publishing jobs
    await step.run('dispatch-publishing-jobs', async () => {
      const db = await getD1Client();

      // Look up active auto-publish channels for this tenant
      // Uses publishing_channels with an auto-publish flag pattern:
      // any active channel for tenant = eligible (future: add auto_publish boolean column)
      const { data: channelsData } = await db
        .from('publishing_channels')
        .select('id,provider,external_account_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      const channels = (channelsData ?? []) as Pick<PublishingChannel, 'id' | 'provider' | 'external_account_id'>[];

      if (channels.length === 0) {
        logger.info('[videoPublish] No auto-publish channels, skipping', { jobId, tenantId });
        return { dispatched: 0 };
      }

      const now = Math.floor(Date.now() / 1000);
      const dispatched: string[] = [];

      for (const channel of channels) {
        const publishJobId = randomUUID();

        await db.from('publishing_jobs').insert({
          id: publishJobId,
          tenant_id: tenantId,
          video_job_id: jobId,
          channel_id: channel.id,
          status: 'scheduled',
          caption: `Published via Sophia AI Factory`,
          hashtags_json: JSON.stringify([]),
          product_link: null,
          scheduled_at: now,
          started_at: null,
          finished_at: null,
          retry_count: 0,
          error: null,
          created_at: now,
        });

        dispatched.push(publishJobId);

        await inngest.send({
          id: `publish-${publishJobId}-attempt-0`,
          name: 'publish.scheduled',
          data: { jobId: publishJobId, tenantId, userId },
        });
      }

      logger.info('[videoPublish] Dispatched publishing jobs', { jobId, dispatched: dispatched.length });
      return { dispatched: dispatched.length };
    });

    await step.sendEvent('emit-published', {
      name: 'video.published',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'published' };
  },
);
