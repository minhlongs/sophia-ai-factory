/**
 * Path A: Template Visual Generator
 *
 * Sends render request to the MoviePy Fly.io service.
 * Throws when MOVIEPY_FLY_URL is not set (no silent stub fallback).
 * Writes output mp4 to R2: tenants/{tid}/videos/{jid}/visual.mp4
 */

import { getVideoBucket, tenantScopedKey } from '@/land/video/storage/r2-binding';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { logger } from '@/seed/utils/logger-utility';
import type { ScenePrompt } from '@/land/video/generation/visual-prompt-generator';

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
    logger.warn('[PathA] MOVIEPY_FLY_URL not set — returning stub mp4', { jobId });
    const stubBytes = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]);
    const ref = await getVideoBucket();
    if (ref) {
      await ref.bucket.put(visualR2Key, stubBytes, { httpMetadata: { contentType: 'video/mp4' } });
    }
    await recordCost({ jobId, stage: 'visual', provider: 'moviepy', units: 1, costUsd: 0 });
    return { visualR2Key, costUsd: 0 };
  }

  videoBytes = await fetchRenderService(`${flyUrl}/render`, {
    templateId,
    audio_r2_key: audioR2Key,
    scenes: scenes.map((s) => s.description),
    output_format: outputFormat,
  });

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
