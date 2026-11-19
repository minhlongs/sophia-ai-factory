/**
 * Inngest Function: videoScripting
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.requested
 * Transition: queued → scripting
 * Generates video script via OpenRouter API (real LLM call).
 * Emits: video.script.ready, campaign.progress (SSE)
 */

import { NonRetriableError } from 'inngest';
import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { assertValidTransition } from '@/land/video/generation/video-job-fsm';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
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
  tenant_id: string;
  user_id: string;
}

async function markJobFailed(jobId: string, tenantId: string, reason: string): Promise<void> {
  const db = createServerClient();
  await db
    .from('video_jobs')
    .update({ status: 'failed', error_message: reason, updated_at: Math.floor(Date.now() / 1000) })
    .eq('id', jobId)
    .eq('tenant_id', tenantId);
  await emitProgress(jobId, 'error', 0, reason);
}

/**
 * Generate video script using ONLY the verified customer's BYOK OpenRouter key.
 * Platform env OPENROUTER_API_KEY is strictly prohibited (Sophia BYOK doctrine).
 */
async function generateScriptWithCustomerByok(userId: string, prompt: string): Promise<string> {
  const lookup = await lookupUserApiKey(userId, 'openrouter');
  if (lookup.status === 'NOT_CONFIGURED' || (lookup.status === 'FOUND' && !lookup.key.trim())) {
    throw new NonRetriableError('Customer OpenRouter API key is required for video script generation');
  }
  if (lookup.status !== 'FOUND') {
    throw new NonRetriableError('Customer OpenRouter credential could not be read');
  }

  try {
    return await resilientChatCompletion(`Write a video script for: ${prompt}`, {
      openRouterKey: lookup.key.trim(),
      anthropicKey: undefined,
      enableFallback: false,
      model: 'openai/gpt-4o-mini',
    });
  } catch (err) {
    if (err instanceof ProviderInvalidKeyError) {
      throw new NonRetriableError('Customer OpenRouter API key is invalid or unauthorized');
    }
    if (err instanceof ProviderQuotaExceededError) {
      throw new NonRetriableError('Customer OpenRouter API quota exceeded');
    }
    throw err;
  }
}

export const videoScripting = inngest.createFunction(
  { id: 'video-scripting', retries: 3 },
  { event: 'video.requested' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    if (!jobId || !tenantId || !userId || !String(userId).trim()) {
      throw new NonRetriableError('[videoScripting] Missing required jobId, tenantId, or userId');
    }

    await emitProgress(jobId, 'scripting', 0, 'Bắt đầu tạo kịch bản / Starting script generation');

    const job = await step.run('load-job', async () => {
      const db = createServerClient();
      const { data } = await db
        .from('video_jobs')
        .select('status, prompt, tenant_id, user_id')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new NonRetriableError(`[videoScripting] Job not found: ${jobId}`);
      if (row.tenant_id !== tenantId || row.user_id !== userId) {
        throw new NonRetriableError(`[videoScripting] Tenant/user ownership mismatch for job: ${jobId}`);
      }
      return row;
    });

    await step.run('transition-to-scripting', async () => {
      assertValidTransition(job.status, 'scripting');
      const db = createServerClient();
      await db
        .from('video_jobs')
        .update({ status: 'scripting', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);
    });

    await step.run('generate-script', async () => {
      try {
        const scriptText = await generateScriptWithCustomerByok(job.user_id, job.prompt);
        const db = createServerClient();
        await db
          .from('video_jobs')
          .update({ script_text: scriptText, updated_at: Math.floor(Date.now() / 1000) })
          .eq('id', jobId)
          .eq('tenant_id', tenantId);
      } catch (err) {
        if (err instanceof NonRetriableError) {
          await markJobFailed(jobId, tenantId, err.message);
        }
        throw err;
      }
    });

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
