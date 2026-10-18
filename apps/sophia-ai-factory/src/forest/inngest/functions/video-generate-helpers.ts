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
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { WanVideoClient } from '@/land/video/generation/wan21-client';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { FishSpeechClient } from '@/land/video/generation/fish-speech-client';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: R2 bucket binding
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { CheckpointService } from '@/forest/pipeline';
import {
  uploadBufferWithBucketGetter,
  downloadToBuffer,
} from './video-generate-storage';

export { getVideoBucket, downloadToBuffer };

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

// ── R2 Upload ─────────────────────────────────────────────────────────────

export async function uploadBufferToR2(
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  return uploadBufferWithBucketGetter(getVideoBucket, key, data, contentType);
}
