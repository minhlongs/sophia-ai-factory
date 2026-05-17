/**
 * Inngest Function: videoCompose
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.visual.ready
 * Transition: visual_pending → composing
 * Pass-through: HeyGen already outputs complete video, no composition needed.
 * Emits: video.composed
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import { tenantScopedKey } from '@/lib/video/r2-binding';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
  visual_r2_key: string;
}

export const videoCompose = inngest.createFunction(
  { id: 'video-compose', retries: 3 },
  { event: 'video.visual.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    const job = await step.run('load-job', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status, visual_r2_key')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoCompose] Job not found: ${jobId}`);
      return row;
    });

    await step.run('transition-to-composing', async () => {
      assertValidTransition(job.status, 'composing');
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ status: 'composing', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('pass-through-compose', async () => {
      // HeyGen outputs complete mp4 — pass visual_r2_key (URL) as final_r2_key
      const finalKey = job.visual_r2_key.startsWith('http')
        ? job.visual_r2_key
        : tenantScopedKey(tenantId, jobId, 'final.mp4');
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ final_r2_key: finalKey, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'composing', provider: 'internal', units: 0, costUsd: 0 });
    });

    await step.sendEvent('emit-composed', {
      name: 'video.composed',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'composing' };
  },
);
