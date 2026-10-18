/**
 * Helper database queries and progress emitter for videoTTS Inngest function.
 * @module forest/inngest/functions/video-tts-helpers
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** Progress payload emitted via inngest.send for SSE streaming */
export interface ProgressPayload {
  type: 'campaign.progress';
  campaignId: string;
  step: 'scripting' | 'tts' | 'visual' | 'compose' | 'publish' | 'complete' | 'error';
  progress: number;
  message: string;
  timestamp: number;
}

export interface VideoJobRow<TStatus extends string = string> {
  status: TStatus;
  script_text: string | null;
  prompt: string;
  audio_r2_key: string | null;
}

/**
 * Emit a campaign.progress event for SSE subscribers.
 * Uses inngest.send() for cross-function event delivery.
 */
export async function emitProgress(
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
  logger.info('[videoTTS] Progress emitted', { campaignId, step, progress, message });
}

export async function fetchVideoJobForTransition<TStatus extends string>(
  jobId: string,
  tenantId: string,
): Promise<VideoJobRow<TStatus>> {
  const db = createServerClient();
  const { data } = await db
    .from('video_jobs')
    .select('status, script_text, prompt, audio_r2_key')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single();

  const row = data as VideoJobRow<TStatus> | null;
  if (!row) throw new Error(`[videoTTS] Job not found: ${jobId}`);
  return row;
}

export async function markVideoJobTtsPending(jobId: string): Promise<void> {
  const db = createServerClient();
  await db
    .from('video_jobs')
    .update({ status: 'tts_pending', updated_at: Math.floor(Date.now() / 1000) })
    .eq('id', jobId);
}

export async function fetchVideoJobForSynthesis(
  jobId: string,
): Promise<Pick<VideoJobRow, 'script_text' | 'prompt' | 'audio_r2_key'>> {
  const db = createServerClient();
  const { data } = await db
    .from('video_jobs')
    .select('script_text, prompt, audio_r2_key')
    .eq('id', jobId)
    .single();

  const row = data as Pick<VideoJobRow, 'script_text' | 'prompt' | 'audio_r2_key'> | null;
  if (!row) throw new Error(`[videoTTS] Job not found during synthesis: ${jobId}`);
  return row;
}

export async function saveVideoJobAudioKey(jobId: string, r2Key: string): Promise<void> {
  const db = createServerClient();
  await db
    .from('video_jobs')
    .update({ audio_r2_key: r2Key, updated_at: Math.floor(Date.now() / 1000) })
    .eq('id', jobId);
}
