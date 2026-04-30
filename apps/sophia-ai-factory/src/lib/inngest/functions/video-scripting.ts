/**
 * Inngest Function: videoScripting
 *
 * Listens: video.requested
 * Transition: queued → scripting
 * Stub: no real script generation yet (Phase 7).
 * Emits: video.script.ready
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
}

export const videoScripting = inngest.createFunction(
  { id: 'video-scripting', retries: 3 },
  { event: 'video.requested' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    await step.run('transition-to-scripting', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoScripting] Job not found: ${jobId}`);

      assertValidTransition(row.status, 'scripting');
      await db
        .from('video_jobs')
        .update({ status: 'scripting', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('stub-script-generation', async () => {
      // Phase 7 will replace with real LLM script generation
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({
          script_text: `[STUB] Auto-generated script for job ${jobId}`,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'scripting', provider: 'openrouter', units: 0, costUsd: 0 });
    });

    await step.sendEvent('emit-script-ready', {
      name: 'video.script.ready',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'scripting' };
  },
);
