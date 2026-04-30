/**
 * Inngest Function: videoUpload
 *
 * Listens: video.composed
 * Transition: composing → uploaded
 * Stub: marks R2 key as uploaded, no real upload yet.
 * Emits: video.uploaded
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
}

export const videoUpload = inngest.createFunction(
  { id: 'video-upload', retries: 3 },
  { event: 'video.composed' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    await step.run('transition-to-uploaded', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoUpload] Job not found: ${jobId}`);

      assertValidTransition(row.status, 'uploaded');
      await db
        .from('video_jobs')
        .update({ status: 'uploaded', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'uploaded', provider: 'cloudflare-r2', units: 0, costUsd: 0 });
    });

    await step.sendEvent('emit-uploaded', {
      name: 'video.uploaded',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'uploaded' };
  },
);
