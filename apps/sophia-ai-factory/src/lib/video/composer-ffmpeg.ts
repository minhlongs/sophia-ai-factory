/**
 * FFmpeg Composer
 *
 * Merges audio + visual + optional subtitle tracks into final.mp4
 * via the MoviePy Fly service (/compose endpoint).
 * Writes output to R2: tenants/{tid}/videos/{jid}/final.mp4
 */

import { getVideoBucket, tenantScopedKey } from '@/lib/video/r2-binding';
import { recordCost } from '@/lib/video/cost-ledger';
import { logger } from '@/lib/utils/logger-utility';

export interface ComposeInput {
  jobId: string;
  tenantId: string;
  audioR2Key: string;
  visualR2Key: string;
  subtitleSrt?: string;
}

export interface ComposeResult {
  finalR2Key: string;
  costUsd: number;
}

const STUB_MP4_B64 = 'AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAG21kYXQ=';

/**
 * Compose audio + visual + subtitles into final MP4.
 * Cost: ~$0.05 per compose operation.
 */
export async function composeFinalVideo(input: ComposeInput): Promise<ComposeResult> {
  const { jobId, tenantId, audioR2Key, visualR2Key, subtitleSrt = '' } = input;
  const finalR2Key = tenantScopedKey(tenantId, jobId, 'final.mp4');
  const flyUrl = process.env.MOVIEPY_FLY_URL;
  const costUsd = 0.05;

  let videoBytes: ArrayBuffer;

  if (!flyUrl) {
    logger.warn('[Composer] MOVIEPY_FLY_URL not set — using stub final mp4', { jobId });
    videoBytes = Buffer.from(STUB_MP4_B64, 'base64').buffer;
  } else {
    const res = await fetch(`${flyUrl}/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_r2_key: audioR2Key,
        visual_r2_key: visualR2Key,
        subtitle_srt: subtitleSrt,
        output_format: 'mp4',
      }),
    });

    if (!res.ok) {
      throw new Error(`[Composer] MoviePy compose failed: ${res.status} ${res.statusText}`);
    }
    videoBytes = await res.arrayBuffer();
  }

  const ref = await getVideoBucket();
  if (ref) {
    await ref.bucket.put(finalR2Key, videoBytes, { httpMetadata: { contentType: 'video/mp4' } });
    logger.info('[Composer] Final video uploaded to R2', { jobId, finalR2Key });
  } else {
    logger.warn('[Composer] VIDEO_BUCKET unavailable — R2 write skipped', { jobId });
  }

  await recordCost({ jobId, stage: 'compose', provider: 'moviepy-ffmpeg', units: 1, costUsd });

  return { finalR2Key, costUsd };
}
