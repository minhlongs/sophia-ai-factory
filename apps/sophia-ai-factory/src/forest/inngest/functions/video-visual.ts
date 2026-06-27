/**
 * Inngest Function: videoVisual
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.tts.ready
 * Transition: tts_pending → visual_pending
 * Generates talking-head video via HeyGen API (shared helpers).
 * Falls back to placeholder if HeyGen key not configured.
 * Emits: video.visual.ready, campaign.progress (SSE)
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { assertValidTransition } from '@/land/video/generation/video-job-fsm';
import { createHeyGenVideo } from '@/land/video/templates/heygen-helpers';
import { logger } from '@/seed/utils/logger-utility';
import type { VideoJobStatus } from '@/land/video/generation/video-job-fsm';

/** Progress payload emitted via inngest.send for SSE streaming */
interface ProgressPayload {
  type: 'campaign.progress';
  campaignId: string;
  step: 'scripting' | 'tts' | 'visual' | 'compose' | 'publish' | 'complete' | 'error';
  progress: number;
  message: string;
  timestamp: number;
}

/**
 * Emit a campaign.progress event for SSE subscribers.
 * Uses inngest.send() for cross-function event delivery.
 */
async function emitProgress(
  campaignId: string,
  step: ProgressPayload['step'],
  progress: number,
  message: string,
): Promise<void> {
  const payload: ProgressPayload = {
    type: 'campaign.progress',
    campaignId,
    step,
    progress,
    message,
    timestamp: Date.now(),
  };
  await inngest.send({
    id: `progress-${campaignId}-${step}-${payload.timestamp}`,
    name: 'campaign.progress',
    data: payload,
  });
  logger.info('[videoVisual] Progress emitted', { campaignId, step, progress, message });
}

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

    // Emit: visual started
    await emitProgress(jobId, 'visual', 30, 'Bắt đầu tạo video / Starting visual generation');

    const job = await step.run('load-job', async () => {
      const db = createServerClient();
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
      const db = createServerClient();
      await db
        .from('video_jobs')
        .update({ status: 'visual_pending', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    const videoUrl: string | null = null;
    await step.run('generate-heygen-video', async () => {
      const apiKey = process.env.HEYGEN_API_KEY;
      if (!apiKey) {
        throw new Error('[videoVisual] HEYGEN_API_KEY not configured — job cannot proceed');
      }
      const script = job.script_text || job.prompt || '';
      const { videoId } = await createHeyGenVideo({ script, apiKey });
      logger.info('[videoVisual] HeyGen video submitted', { jobId, videoId });
      const db = createServerClient();
      await db
        .from('video_jobs')
        .update({
          heygen_video_id: videoId,
          updated_at: Math.floor(Date.now() / 1000),
        })
        .eq('id', jobId);
    });

    // Emit: visual complete (40%)
    await emitProgress(jobId, 'visual', 40, 'Video đã tạo xong / Visual generation complete');

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
