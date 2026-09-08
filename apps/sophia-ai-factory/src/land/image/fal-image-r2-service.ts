/**
 * @module land/image/fal-image-r2-service
 *
 * fal.ai image → R2 self-hosting service.
 *
 * Downloads the temporary fal.ai CDN URL and persists it into the shared
 * VIDEO_BUCKET (`sophia-videos`) under `media/fal/{jobId}/{filename}.png`.
 * Falls back to the original CDN URL when R2 is unavailable (local dev, test).
 *
 * Layer rule: land — imports seed + tree only. No forest imports.
 */

import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export interface FalImageR2Result {
  /** Public URL (R2 if bound, otherwise the original fal CDN URL). */
  permanentUrl: string;
  /** R2 object key (empty when R2 unavailable). */
  storageKey: string;
  /** Bucket label ('VIDEO_BUCKET' | 'none'). */
  bucket: string;
  /** Downloaded byte size (0 when R2 unavailable). */
  sizeBytes: number;
  /** True when the original CDN URL was kept as fallback. */
  usedFallback: boolean;
}

/**
 * Download a fal.ai CDN image and store it in R2.
 *
 * Failure modes:
 * - R2 binding null → fallback to CDN URL, usedFallback=true, no throw.
 * - Download failure → throws (caller decides whether to fail the job).
 * - R2 PUT failure → throws (caller must not mark job completed).
 */
export async function storeFalImageInR2(
  cdnUrl: string,
  jobId: string,
): Promise<FalImageR2Result> {
  const storageKey = `media/fal/${jobId}/image.png`;

  const r2 = await getVideoBucket();
  if (!r2) {
    logger.warn('[fal-image-r2-service] R2 binding unavailable — keeping fal CDN URL', {
      jobId,
    });
    return { permanentUrl: cdnUrl, storageKey: '', bucket: 'none', sizeBytes: 0, usedFallback: true };
  }

  if (!shouldAllowRequest('r2')) {
    throw new Error('[fal-image-r2-service] Circuit breaker open for r2');
  }

  try {
    const response = await fetch(cdnUrl);
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const body = await response.arrayBuffer();
    const sizeBytes = body.byteLength;

    await r2.bucket.put(storageKey, body, {
      httpMetadata: { contentType: 'image/png' },
    });

    recordSuccess('r2');

    const permanentUrl = r2.publicBaseUrl
      ? `${r2.publicBaseUrl}/${storageKey}`
      : cdnUrl;

    logger.info('[fal-image-r2-service] fal.ai image stored in R2', {
      jobId,
      storageKey,
      sizeBytes,
      usingPublicUrl: r2.publicBaseUrl !== null,
    });

    return { permanentUrl, storageKey, bucket: 'VIDEO_BUCKET', sizeBytes, usedFallback: false };
  } catch (err) {
    const kind = classifyError(err);
    recordFailure('r2', kind);
    throw err;
  }
}
