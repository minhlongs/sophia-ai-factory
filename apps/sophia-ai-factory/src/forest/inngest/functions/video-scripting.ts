/**
 * Inngest Function: videoScripting
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.requested
 * Transition: queued → scripting
 * Generates video script via OpenRouter API (real LLM call).
 * Emits: video.script.ready, campaign.progress (SSE)
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { assertValidTransition } from '@/land/video/generation/video-job-fsm';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
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
  logger.info('[videoScripting] Progress emitted', { campaignId, step, progress, message });
}

interface VideoJobRow {
  status: VideoJobStatus;
  prompt: string;
}

const _SCRIPT_SYSTEM_PROMPT = `You are a professional video script writer for Sophia AI Factory.
Write a concise, engaging video script (60-90 seconds when spoken) based on the user's prompt.
Include scene descriptions in [brackets] and narrator text.
Output in Vietnamese by default unless the prompt is in English.`;

async function generateScript(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('[videoScripting] OPENROUTER_API_KEY not configured — job cannot proceed');
  }
  const content = await resilientChatCompletion(`Write a video script for: ${prompt}`, {
    openRouterKey: apiKey,
    anthropicKey: undefined,
    enableFallback: false,
    model: 'openai/gpt-4o-mini',
  });
  return content;
}

export const videoScripting = inngest.createFunction(
  { id: 'video-scripting', retries: 3 },
  { event: 'video.requested' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    // Emit: scripting started
    await emitProgress(jobId, 'scripting', 0, 'Bắt đầu tạo kịch bản / Starting script generation');

    const job = await step.run('load-job', async () => {
      const db = createServerClient();
      const { data } = await db
        .from('video_jobs')
        .select('status, prompt')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoScripting] Job not found: ${jobId}`);
      return row;
    });

    await step.run('transition-to-scripting', async () => {
      assertValidTransition(job.status, 'scripting');
      const db = createServerClient();
      await db
        .from('video_jobs')
        .update({ status: 'scripting', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    let scriptText: string;
    await step.run('generate-script', async () => {
      scriptText = await generateScript(job.prompt);
      const db = createServerClient();
      await db
        .from('video_jobs')
        .update({ script_text: scriptText, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    // Emit: scripting complete (10%)
    await emitProgress(jobId, 'scripting', 10, 'Kịch bản đã tạo xong / Script generated');

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'scripting', provider: 'openrouter', units: 1, costUsd: 0.002 });
    });

    await step.sendEvent('emit-script-ready', {
      name: 'video.script.ready',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'scripting' };
  },
);
