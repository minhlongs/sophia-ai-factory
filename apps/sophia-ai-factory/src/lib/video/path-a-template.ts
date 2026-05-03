/**
 * Path A: Template Visual Generator
 *
 * Sends render request to the MoviePy Fly.io service.
 * Falls back to a 1-second black MP4 stub when MOVIEPY_FLY_URL is not set.
 * Writes output mp4 to R2: tenants/{tid}/videos/{jid}/visual.mp4
 */

import { getVideoBucket, tenantScopedKey } from '@/lib/video/r2-binding';
import { recordCost } from '@/lib/video/cost-ledger';
import { logger } from '@/seed/utils/logger-utility';
import type { ScenePrompt } from '@/lib/video/visual-prompt-generator';

export interface PathAInput {
  jobId: string;
  tenantId: string;
  templateId: string;
  audioR2Key: string;
  scenes: ScenePrompt[];
  outputFormat?: 'mp4';
}

export interface PathAResult {
  visualR2Key: string;
  costUsd: number;
}

/** 1-second silent black mp4 (base64) used as fallback when service unavailable */
const STUB_MP4_B64 =
  'AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAG21kYXQ=';

async function fetchRenderService(url: string, body: object): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`[PathA] MoviePy render failed: ${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
}

/**
 * Render template video via MoviePy service and write to R2.
 * Cost: ~$0.20-0.50 per video.
 */
export async function renderTemplateVideo(input: PathAInput): Promise<PathAResult> {
  const { jobId, tenantId, templateId, audioR2Key, scenes, outputFormat = 'mp4' } = input;
  const visualR2Key = tenantScopedKey(tenantId, jobId, 'visual.mp4');
  const flyUrl = process.env.MOVIEPY_FLY_URL;

  let videoBytes: ArrayBuffer;
  let costUsd = 0.25; // template path average

  if (!flyUrl) {
    logger.warn('[PathA] MOVIEPY_FLY_URL not set — using stub mp4', { jobId });
    videoBytes = Buffer.from(STUB_MP4_B64, 'base64').buffer;
    costUsd = 0;
  } else {
    videoBytes = await fetchRenderService(`${flyUrl}/render`, {
      templateId,
      audio_r2_key: audioR2Key,
      scenes: scenes.map((s) => s.description),
      output_format: outputFormat,
    });
  }

  const ref = await getVideoBucket();
  if (ref) {
    await ref.bucket.put(visualR2Key, videoBytes, {
      httpMetadata: { contentType: 'video/mp4' },
    });
    logger.info('[PathA] Visual uploaded to R2', { jobId, visualR2Key });
  } else {
    logger.warn('[PathA] VIDEO_BUCKET not available — skipping R2 write', { jobId });
  }

  await recordCost({ jobId, stage: 'visual', provider: 'moviepy', units: 1, costUsd });

  return { visualR2Key, costUsd };
}
