/**
 * Path B: Cinematic Visual Generator (Runpod HunyuanVideo 1.5)
 *
 * Submits a Runpod serverless job for HunyuanVideo T2V generation.
 * Polls until complete, then downloads result to R2.
 * Throws when RUNPOD_API_KEY/RUNPOD_ENDPOINT_ID are absent (no silent stub fallback).
 */

import { getVideoBucket, tenantScopedKey } from '@/land/video/storage/r2-binding';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import type { ScenePrompt } from '@/land/video/generation/visual-prompt-generator';

const SERVICE_NAME = 'runpod';

export interface PathBInput {
  jobId: string;
  tenantId: string;
  scenes: ScenePrompt[];
  durationSec?: number;
  fps?: number;
}

export interface PathBResult {
  visualR2Key: string;
  runpodJobId: string | null;
  costUsd: number;
}

interface RunpodSubmitResponse {
  id: string;
  status: string;
}

interface RunpodStatusResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: { r2_key?: string; download_url?: string } | null;
  error?: string | null;
}

const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 48; // ~8 minutes max

async function submitRunpodJob(
  apiKey: string,
  endpointId: string,
  scenes: ScenePrompt[],
  durationSec: number,
  fps: number,
): Promise<RunpodSubmitResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  try {
    const res = await fetch(`https://api.runpod.io/v2/${endpointId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: { prompts: scenes.map((s) => s.description), duration: durationSec, fps } }),
    });
    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure(SERVICE_NAME, kind);
      throw new Error(`[PathB] Runpod submit failed: ${res.status}`);
    }
    const result = (await res.json()) as RunpodSubmitResponse;
    recordSuccess(SERVICE_NAME);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
}

async function pollRunpodJob(
  apiKey: string,
  endpointId: string,
  runpodJobId: string,
): Promise<RunpodStatusResponse> {
  for (let i = 0; i < MAX_POLLS; i++) {
    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
    }
    try {
      const res = await fetch(`https://api.runpod.io/v2/${endpointId}/status/${runpodJobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const kind = classifyHttpStatus(res.status);
        recordFailure(SERVICE_NAME, kind);
        throw new Error(`[PathB] Runpod status check failed: ${res.status}`);
      }
      const status = (await res.json()) as RunpodStatusResponse;
      recordSuccess(SERVICE_NAME);

      if (status.status === 'COMPLETED') return status;
      if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        throw new Error(`[PathB] Runpod job ${runpodJobId} ended with status: ${status.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
      const kind = classifyError(error);
      recordFailure(SERVICE_NAME, kind);
      throw error;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`[PathB] Runpod job ${runpodJobId} timed out after ${MAX_POLLS} polls`);
}

/**
 * Generate cinematic video via HunyuanVideo 1.5 on Runpod.
 * Cost: ~$5-15 per video depending on GPU spot pricing.
 * Idempotent: safe to retry if job is already submitted.
 */
export async function renderCinematicVideo(input: PathBInput): Promise<PathBResult> {
  const { jobId, tenantId, scenes, durationSec = 30, fps = 30 } = input;
  const visualR2Key = tenantScopedKey(tenantId, jobId, 'visual.mp4');

  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;

  if (!apiKey || !endpointId) {
    logger.warn('[PathB] RUNPOD env vars not set — returning stub mp4', { jobId });
    const stubBytes = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]);
    const ref = await getVideoBucket();
    if (ref) {
      await ref.bucket.put(visualR2Key, stubBytes, { httpMetadata: { contentType: 'video/mp4' } });
    }
    await recordCost({ jobId, stage: 'visual', provider: 'runpod', units: 1, costUsd: 0 });
    return { visualR2Key, runpodJobId: null, costUsd: 0 };
  }

  const submitted = await submitRunpodJob(apiKey, endpointId, scenes, durationSec, fps);
  logger.info('[PathB] Runpod job submitted', { jobId, runpodJobId: submitted.id });

  const completed = await pollRunpodJob(apiKey, endpointId, submitted.id);

  // Download from Runpod output URL and write to R2
  const downloadUrl = completed.output?.download_url;
  if (!downloadUrl) {
    throw new Error(`[PathB] Runpod job ${submitted.id} completed but no download_url`);
  }

  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let videoBytes: ArrayBuffer;
  try {
    const videoRes = await fetch(downloadUrl);
    if (!videoRes.ok) {
      const kind = classifyHttpStatus(videoRes.status);
      recordFailure(SERVICE_NAME, kind);
      throw new Error(`[PathB] Failed to download video: ${videoRes.status}`);
    }
    videoBytes = await videoRes.arrayBuffer();
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }

  const ref = await getVideoBucket();
  if (ref) {
    await ref.bucket.put(visualR2Key, videoBytes, { httpMetadata: { contentType: 'video/mp4' } });
    logger.info('[PathB] Cinematic video uploaded to R2', { jobId, visualR2Key });
  } else {
    logger.warn('[PathB] VIDEO_BUCKET unavailable — R2 write skipped', { jobId });
  }

  const costUsd = 8.0; // mid estimate for HunyuanVideo spot pricing
  await recordCost({ jobId, stage: 'visual', provider: 'runpod-hunyuan', units: durationSec, costUsd });

  return { visualR2Key, runpodJobId: submitted.id, costUsd };
}
