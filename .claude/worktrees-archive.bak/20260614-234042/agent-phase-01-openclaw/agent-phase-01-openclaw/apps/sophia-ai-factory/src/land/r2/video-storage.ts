/**
 * Video Storage — R2 Put Helper
 *
 * Thin wrapper around the VIDEO_BUCKET R2 binding for uploading video blobs.
 * Re-uses the existing `getVideoBucket()` binding (same bucket as audio uploads).
 *
 * This module is the canonical upload path for muxed MP4 objects that originate
 * outside the video pipeline (e.g., Cloudconvert export downloads).
 *
 * Key pattern: caller-supplied — no opinionated key structure enforced here.
 *
 * @module lib/r2/video-storage
 */

import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from '@/land/video/r2-binding';

/**
 * Upload a video buffer to R2.
 *
 * @param key         - R2 object key (e.g. "videos/{missionId}.mp4")
 * @param blob        - Raw video bytes
 * @param contentType - MIME type, defaults to "video/mp4"
 * @returns Public URL when R2_PUBLIC_BASE_URL is set, otherwise the raw key.
 *          Returns null when VIDEO_BUCKET binding is unavailable.
 */
export async function putVideoObject(
  key: string,
  blob: ArrayBuffer,
  contentType = 'video/mp4',
): Promise<string | null> {
  const ref = await getVideoBucket();

  if (!ref) {
    logger.warn('[video-storage] VIDEO_BUCKET unavailable — skipping R2 upload', { key });
    return null;
  }

  await ref.bucket.put(key, blob, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  const base = ref.publicBaseUrl?.replace(/\/$/, '');
  const url = base ? `${base}/${key}` : key;

  logger.info('[video-storage] Video uploaded to R2', { key, bytes: blob.byteLength, url });
  return url;
}

/**
 * Check whether an object exists in R2 and has non-zero size.
 *
 * @returns The public URL when the object exists with size > 0, otherwise null.
 */
export async function headVideoObject(key: string): Promise<string | null> {
  const ref = await getVideoBucket();
  if (!ref) return null;

  try {
    const head = await ref.bucket.head(key);
    if (head && head.size > 0) {
      const base = ref.publicBaseUrl?.replace(/\/$/, '');
      return base ? `${base}/${key}` : key;
    }
  } catch {
    // head() throws when object is absent — treat as not found
  }

  return null;
}
