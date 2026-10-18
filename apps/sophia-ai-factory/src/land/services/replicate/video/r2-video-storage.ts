/**
 * R2 storage helper for Replicate video outputs.
 *
 * Layer: land — imports seed and land only.
 */

import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from '@/land/video/storage/r2-binding';

export async function storeToR2(videoId: string, sourceUrl: string): Promise<string> {
  const r2 = await getVideoBucket();

  if (!r2) {
    logger.warn('[ReplicateVideoService] R2 binding unavailable — using Replicate URL as fallback', {
      videoId,
    });
    return sourceUrl;
  }

  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    logger.error('[ReplicateVideoService] Failed to download video from Replicate URL', {
      videoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return sourceUrl;
  }

  if (!response.ok) {
    logger.error('[ReplicateVideoService] Download failed', {
      videoId,
      status: response.status,
    });
    return sourceUrl;
  }

  const body = await response.arrayBuffer();
  const key = `replicate/${videoId}/${Date.now()}.mp4`;

  try {
    await r2.bucket.put(key, body, {
      httpMetadata: { contentType: 'video/mp4' },
    });
  } catch (err) {
    logger.error('[ReplicateVideoService] R2 upload failed', {
      videoId,
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return sourceUrl;
  }

  const permanentUrl = r2.publicBaseUrl ? `${r2.publicBaseUrl}/${key}` : sourceUrl;
  logger.info('[ReplicateVideoService] Video stored in R2', {
    videoId,
    key,
    sizeBytes: body.byteLength,
  });
  return permanentUrl;
}
