/**
 * Inngest Function: videoCompose
 *
 * Listens: video.visual.ready
 * Transition: visual_pending → composing
 * Stub: no real composition yet (Phase 8).
 * Emits: video.composed
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import { tenantScopedKey } from '@/lib/video/r2-binding';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
}

export const videoCompose = inngest.createFunction(
  { id: 'video-compose', retries: 3 },
  { event: 'video.visual.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    await step.run('transition-to-composing', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoCompose] Job not found: ${jobId}`);

      assertValidTransition(row.status, 'composing');
      await db
        .from('video_jobs')
        .update({ status: 'composing', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('stub-compose', async () => {
      // Phase 8 will replace with Remotion/MoviePy composition
      const finalKey = tenantScopedKey(tenantId, jobId, 'final.mp4');
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ final_r2_key: finalKey, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'composing', provider: 'remotion', units: 0, costUsd: 0 });
    });

    await step.sendEvent('emit-composed', {
      name: 'video.composed',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'composing' };
  },
);
