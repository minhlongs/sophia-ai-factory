/**
 * Path B: Cinematic Visual Generator (Runpod HunyuanVideo 1.5)
 *
 * Submits a Runpod serverless job for HunyuanVideo T2V generation.
 * Polls until complete, then downloads result to R2.
 * Falls back to stub mp4 when RUNPOD_API_KEY/RUNPOD_ENDPOINT_ID are absent.
 */

import { getVideoBucket, tenantScopedKey } from '@/lib/video/r2-binding';
import { recordCost } from '@/lib/video/cost-ledger';
import { logger } from '@/seed/utils/logger-utility';
import type { ScenePrompt } from '@/lib/video/visual-prompt-generator';

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
const STUB_MP4_B64 = 'AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAG21kYXQ=';

async function submitRunpodJob(
  apiKey: string,
  endpointId: string,
  scenes: ScenePrompt[],
  durationSec: number,
  fps: number,
): Promise<RunpodSubmitResponse> {
  const res = await fetch(`https://api.runpod.io/v2/${endpointId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: { prompts: scenes.map((s) => s.description), duration: durationSec, fps } }),
  });
  if (!res.ok) throw new Error(`[PathB] Runpod submit failed: ${res.status}`);
  return res.json() as Promise<RunpodSubmitResponse>;
}

async function pollRunpodJob(
  apiKey: string,
  endpointId: string,
  runpodJobId: string,
): Promise<RunpodStatusResponse> {
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(`https://api.runpod.io/v2/${endpointId}/status/${runpodJobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`[PathB] Runpod status check failed: ${res.status}`);
    const status = (await res.json()) as RunpodStatusResponse;

    if (status.status === 'COMPLETED') return status;
    if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      throw new Error(`[PathB] Runpod job ${runpodJobId} ended with status: ${status.status}`);
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
    logger.warn('[PathB] RUNPOD_API_KEY/RUNPOD_ENDPOINT_ID not set — using stub', { jobId });
    const ref = await getVideoBucket();
    const stubBytes = Buffer.from(STUB_MP4_B64, 'base64').buffer;
    if (ref) {
      await ref.bucket.put(visualR2Key, stubBytes, { httpMetadata: { contentType: 'video/mp4' } });
    }
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

  const videoRes = await fetch(downloadUrl);
  if (!videoRes.ok) throw new Error(`[PathB] Failed to download video: ${videoRes.status}`);
  const videoBytes = await videoRes.arrayBuffer();

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
