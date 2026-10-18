import { getVideoBucket, tenantScopedKey } from '@/land/video/storage/r2-binding';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { logger } from '@/seed/utils/logger-utility';
import { withBreaker, BreakerOpenError } from '@/land/video/templates/circuit-breaker';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { ComposeInput, ComposeResult, VideoMetadata } from './types';
import {
  STUB_MP4_B64,
  BREAKER_NAME,
  FINAL_VIDEO_CACHE_CONTROL,
  POSTER_CACHE_CONTROL,
  needsRichCompose,
  metadataFromHeader,
  thumbnailFromHeader,
  buildFlyComposePayload,
} from './filtergraph-builder';

/**
 * Compose audio + visual into final MP4. Optionally adds subtitles, watermark,
 * audio normalization, and thumbnail extraction. Rate-protected by a circuit
 * breaker around the upstream MoviePy fly call.
 */
export async function composeFinalVideo(input: ComposeInput): Promise<ComposeResult> {
  const { jobId, tenantId } = input;
  const finalR2Key = tenantScopedKey(tenantId, jobId, 'final.mp4');
  const flyUrl = process.env.MOVIEPY_FLY_URL;
  const costUsd = needsRichCompose(input) ? 0.07 : 0.05;

  let videoBytes: ArrayBuffer;
  let thumbnailBytes: ArrayBuffer | undefined;
  let metadata: VideoMetadata | undefined;
  let degraded = false;

  if (!flyUrl) {
    logger.warn('[Composer] MOVIEPY_FLY_URL not set — returning stub mp4', { jobId });
    const stubBytes = new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]);
    const ref = await getVideoBucket();
    if (ref) {
      await ref.bucket.put(finalR2Key, stubBytes, { httpMetadata: { contentType: 'video/mp4' } });
    }
    await recordCost({ jobId, stage: 'visual', provider: 'moviepy', units: 1, costUsd: 0 });
    return { finalR2Key, costUsd: 0, degraded: true };
  }

  try {
    const res = await withBreaker(BREAKER_NAME, () => callFly(flyUrl, input));
    videoBytes = await res.arrayBuffer();
    metadata = metadataFromHeader(res.headers.get('X-Sophia-Metadata'));
    thumbnailBytes = input.generateThumbnail
      ? thumbnailFromHeader(res.headers.get('X-Sophia-Thumbnail-B64'))
      : undefined;
  } catch (err) {
    if (err instanceof BreakerOpenError) {
      logger.warn('[Composer] Breaker OPEN — falling back to stub mp4', { jobId });
      videoBytes = Buffer.from(STUB_MP4_B64, 'base64').buffer;
      degraded = true;
    } else {
      throw err;
    }
  }

  const ref = await getVideoBucket();
  if (ref) {
    await ref.bucket.put(finalR2Key, videoBytes, {
      httpMetadata: { contentType: 'video/mp4', cacheControl: FINAL_VIDEO_CACHE_CONTROL },
    });
    logger.info('[Composer] Final video uploaded to R2', { jobId, finalR2Key });
  } else {
    logger.warn('[Composer] VIDEO_BUCKET unavailable — R2 write skipped', { jobId });
  }

  let thumbnailR2Key: string | undefined;
  if (thumbnailBytes && ref) {
    thumbnailR2Key = tenantScopedKey(tenantId, jobId, 'poster.jpg');
    await ref.bucket.put(thumbnailR2Key, thumbnailBytes, {
      httpMetadata: { contentType: 'image/jpeg', cacheControl: POSTER_CACHE_CONTROL },
    });
    logger.info('[Composer] Thumbnail uploaded to R2', { jobId, thumbnailR2Key });
  }

  await recordCost({ jobId, stage: 'compose', provider: 'moviepy-ffmpeg', units: 1, costUsd });

  return { finalR2Key, costUsd, thumbnailR2Key, metadata, degraded };
}

/** Issue the actual HTTP call to MoviePy fly. Wrapped in `withBreaker`. */
export async function callFly(flyUrl: string, input: ComposeInput): Promise<Response> {
  const { path, body } = buildFlyComposePayload(input);

  if (!shouldAllowRequest('ffmpeg')) {
    throw new Error('[Composer] Circuit breaker open for ffmpeg — too many failures');
  }

  try {
    const res = await fetch(`${flyUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`[Composer] MoviePy ${path} failed: ${res.status} ${res.statusText}`);
    }
    recordSuccess('ffmpeg');
    return res;
  } catch (err) {
    const kind = classifyError(err);
    recordFailure('ffmpeg', kind);
    throw err;
  }
}
