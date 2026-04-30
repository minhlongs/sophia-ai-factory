/**
 * Inngest Function: videoPublish
 *
 * Listens: video.uploaded
 * Transition: uploaded → published
 * Emits: video.published
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
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

    await step.sendEvent('emit-published', {
      name: 'video.published',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'published' };
  },
);
