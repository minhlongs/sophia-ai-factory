/**
 * Inngest Function: videoVisual
 *
 * Listens: video.tts.ready
 * Transition: tts_pending → visual_pending
 * Generates talking-head video via HeyGen API (shared helpers).
 * Falls back to placeholder if HeyGen key not configured.
 * Emits: video.visual.ready
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import { createHeyGenVideo } from '@/lib/video/heygen-helpers';
import { logger } from '@/seed/utils/logger-utility';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
  script_text: string;
  audio_r2_key: string;
  prompt: string;
}

export const videoVisual = inngest.createFunction(
  { id: 'video-visual', retries: 3 },
  { event: 'video.tts.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    const job = await step.run('load-job', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status, script_text, audio_r2_key, prompt')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoVisual] Job not found: ${jobId}`);
      return row;
    });

    await step.run('transition-to-visual-pending', async () => {
      assertValidTransition(job.status, 'visual_pending');
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ status: 'visual_pending', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    let videoUrl: string | null = null;
    await step.run('generate-heygen-video', async () => {
      const apiKey = process.env.HEYGEN_API_KEY;
      if (!apiKey) {
        throw new Error('[videoVisual] HEYGEN_API_KEY not configured — job cannot proceed');
      }
      const script = job.script_text || job.prompt || '';
      const { videoId } = await createHeyGenVideo({ script, apiKey });
      logger.info('[videoVisual] HeyGen video submitted', { jobId, videoId });
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({
          heygen_video_id: videoId,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'visual_pending', provider: 'heygen', units: 1, costUsd: 0.50 });
    });

    await step.sendEvent('emit-visual-ready', {
      name: 'video.visual.ready',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'visual_pending', videoUrl };
  },
);
