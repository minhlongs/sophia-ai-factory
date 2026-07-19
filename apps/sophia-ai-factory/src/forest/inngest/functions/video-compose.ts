/**
 * Inngest Function: videoCompose
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.visual.ready
 * Transition: visual_pending → composing
 * Pass-through: HeyGen already outputs complete video, no composition needed.
 * Emits: video.composed, campaign.progress (SSE)
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { assertValidTransition } from '@/land/video/generation/video-job-fsm';
import { tenantScopedKey } from '@/land/video/storage/r2-binding';
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
  logger.info('[videoCompose] Progress emitted', { campaignId, step, progress, message });
}

interface VideoJobRow {
  status: VideoJobStatus;
  visual_r2_key: string;
}

export const videoCompose = inngest.createFunction(
  { id: 'video-compose', retries: 3 },
  { event: 'video.visual.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    // Emit: compose started
    await emitProgress(jobId, 'compose', 50, 'Bắt đầu ghép video / Starting composition');

    const job = await step.run('load-job', async () => {
      const db = createServerClient();
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
      const db = createServerClient();
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
      const db = createServerClient();
      await db
        .from('video_jobs')
        .update({ final_r2_key: finalKey, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    // Emit: compose complete (60%)
    await emitProgress(jobId, 'compose', 60, 'Ghép video hoàn tất / Composition complete');

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
