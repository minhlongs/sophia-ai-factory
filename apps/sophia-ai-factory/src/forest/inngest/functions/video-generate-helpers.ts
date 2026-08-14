/**
 * Shared helpers for video generation pipeline.
 *
 * Extracted from video-generate.ts to keep modules under 200 lines.
 * Contains: progress emission, checkpoint writing, client factories,
 * R2 upload/download, and poll constants.
 *
 * @module forest/inngest/functions/video-generate-helpers
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { WanVideoClient } from '@/land/video/generation/wan21-client';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { FishSpeechClient } from '@/land/video/generation/fish-speech-client';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: R2 bucket binding
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { CheckpointService } from '@/forest/pipeline';

export { getVideoBucket };

// ── Constants ─────────────────────────────────────────────────────────────

export const POLL_INTERVAL_MS = 20_000;
export const POLL_MAX_ATTEMPTS = 18;

// ── Types ─────────────────────────────────────────────────────────────────

export interface ProgressPayload {
  type: 'campaign.progress';
  campaignId: string;
  step: 'scripting' | 'tts' | 'visual' | 'compose' | 'publish' | 'complete' | 'error';
  progress: number;
  message: string;
  timestamp: number;
}

// ── Progress Emission ─────────────────────────────────────────────────────

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
  logger.info('[videoGenerate] Progress emitted', { campaignId, step, progress, message });
}

// ── Checkpoint Writing ────────────────────────────────────────────────────

export async function writeStageCheckpoint(
  pipelineId: string,
  stage: string,
  status: 'in_progress' | 'completed' | 'failed' | 'skipped',
  tenantId: string,
  artifacts: Record<string, unknown> = {},
  error?: string,
): Promise<void> {
  try {
    const svc = new CheckpointService(tenantId);
    await svc.writeCheckpoint(pipelineId, stage, status, artifacts, {
      pipelineType: 'video_generation',
      error,
    });
  } catch (err) {
    logger.warn('[videoGenerate] Checkpoint write failed (non-fatal)', {
      pipelineId,
      stage,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Client Factories ──────────────────────────────────────────────────────

export function getWanClient(): WanVideoClient {
  const apiKey = process.env.WAN_API_KEY;
  if (!apiKey) throw new Error('[videoGenerate] WAN_API_KEY not configured');
  return new WanVideoClient({ apiKey });
}

export function getFishSpeechClient(): FishSpeechClient {
  const apiKey = process.env.FISH_SPEECH_API_KEY;
  if (!apiKey) throw new Error('[videoGenerate] FISH_SPEECH_API_KEY not configured');
  return new FishSpeechClient({ apiKey });
}

// ── R2 Upload / Download ──────────────────────────────────────────────────

export async function uploadBufferToR2(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const ref = await getVideoBucket();
  if (!ref?.bucket) {
    logger.warn('[videoGenerate] R2 bucket not available — skipping upload', { key });
    return;
  }
  await ref.bucket.put(key, data, { httpMetadata: { contentType } });
}

export async function downloadToBuffer(url: string): Promise<ArrayBuffer> {
  if (!shouldAllowRequest('video-download')) {
    throw new Error('[videoGenerate] Circuit breaker open for video-download — too many failures');
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure('video-download', kind);
      throw new Error(`[videoGenerate] Failed to download from ${url}: ${res.status}`);
    }
    recordSuccess('video-download');
    return res.arrayBuffer();
  } catch (error) {
    if (error instanceof Error && error.message.includes('[videoGenerate] Failed to download from')) {
      throw error;
    }
    const kind = classifyError(error);
    recordFailure('video-download', kind);
    throw error;
  }
}
