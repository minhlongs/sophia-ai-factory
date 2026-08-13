/**
 * Video Storage Service
 *
 * Downloads temporary HeyGen video URLs and uploads them to Cloudflare R2.
 * Falls back to the original HeyGen URL when R2 is unavailable (local dev, test).
 *
 * Bucket binding: VIDEO_BUCKET
 * Key patterns:
 *   campaigns/{campaignId}/{timestamp}.mp4  — campaign flow (default)
 *   videos/{userId}/{videoId}.mp4           — user video cron flow (r2Key override)
 */

import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from './r2-binding';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export interface VideoStorageResult {
  permanentUrl: string;
  bucket: string;
  path: string;
  sizeBytes: number;
}

/**
 * Download a video from a HeyGen temporary URL and upload it to R2.
 * If the R2 binding is unavailable or upload fails, falls back to
 * returning the original HeyGen URL so the campaign is never blocked.
 *
 * @param heygenUrl  - Temporary HeyGen CDN URL to download
 * @param campaignId - Campaign ID (used to build key when r2Key not supplied)
 * @param r2Key      - Optional explicit R2 object key (e.g. "videos/{userId}/{videoId}.mp4")
 */
export async function downloadAndStore(
  heygenUrl: string,
  campaignId: string,
  r2Key?: string,
): Promise<VideoStorageResult> {
  const key = r2Key ?? `campaigns/${campaignId}/${Date.now()}.mp4`;

  const r2 = await getVideoBucket();

  if (!r2) {
    logger.warn('[VideoStorageService] R2 binding unavailable — using HeyGen URL as fallback', {
      campaignId,
    });
    return { permanentUrl: heygenUrl, bucket: 'none', path: '', sizeBytes: 0 };
  }

  if (!shouldAllowRequest('r2')) {
    throw new Error('[VideoStorageService] Circuit breaker open for r2 — too many failures');
  }

  try {
    const response = await fetch(heygenUrl);
    if (!response.ok) {
      throw new Error(`[VideoStorageService] Failed to download video: HTTP ${response.status}`);
    }

    recordSuccess('r2');
    const body = await response.arrayBuffer();
    const sizeBytes = body.byteLength;

    await r2.bucket.put(key, body, {
      httpMetadata: { contentType: 'video/mp4' },
    });

    const permanentUrl = r2.publicBaseUrl
      ? `${r2.publicBaseUrl}/${key}`
      : heygenUrl;

    logger.info('[VideoStorageService] Video stored in R2', {
      campaignId,
      key,
      sizeBytes,
      usingPublicUrl: r2.publicBaseUrl !== null,
    });

    return {
      permanentUrl,
      bucket: 'VIDEO_BUCKET',
      path: key,
      sizeBytes,
    };
  } catch (err) {
    const kind = classifyError(err);
    recordFailure('r2', kind);
    throw err;
  }
}
