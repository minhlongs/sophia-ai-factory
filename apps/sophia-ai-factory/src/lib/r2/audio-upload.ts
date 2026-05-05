/**
 * Audio Upload to Cloudflare R2
 *
 * Uploads audio buffers to VIDEO_BUCKET (same binding as video storage).
 * Falls back to data URI when R2 is unavailable, preserving backward compatibility.
 *
 * Key pattern: audio/{userId}/{videoId}/{uuid}.mp3
 *
 * NOTE: If R2_PUBLIC_BASE_URL is not set, returns data URI with a warning.
 * Set R2_PUBLIC_BASE_URL in wrangler.toml secrets to enable durable public URLs.
 */

import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from '@/lib/video/r2-binding';

/**
 * Upload an audio buffer to R2 and return the public URL.
 * On R2 failure, falls back to data URI (backward-compatible).
 *
 * @param buffer      - Raw audio bytes
 * @param contentType - MIME type (e.g. 'audio/mpeg')
 * @param key         - R2 object key (e.g. 'audio/{userId}/{videoId}/{uuid}.mp3')
 * @returns Public URL string or data URI fallback
 */
export async function uploadAudioToR2(
  buffer: ArrayBuffer,
  contentType: string,
  key: string,
): Promise<string> {
  const ref = await getVideoBucket();

  if (!ref) {
    logger.warn('[audio-upload] VIDEO_BUCKET unavailable — falling back to data URI', { key });
    return buildDataUri(buffer, contentType);
  }

  try {
    await ref.bucket.put(key, buffer, { httpMetadata: { contentType } });

    const base = ref.publicBaseUrl?.replace(/\/$/, '');
    if (!base) {
      // R2_PUBLIC_BASE_URL not set — log warning and fall back to data URI
      logger.warn('[audio-upload] R2_PUBLIC_BASE_URL not configured — falling back to data URI. ' +
        'Set R2_PUBLIC_BASE_URL in wrangler.toml to serve audio from R2.', { key });
      return buildDataUri(buffer, contentType);
    }

    const publicUrl = `${base}/${key}`;
    logger.info('[audio-upload] Audio uploaded to R2', { key, publicUrl });
    return publicUrl;
  } catch (err) {
    logger.warn('[audio-upload] R2 put failed — falling back to data URI', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return buildDataUri(buffer, contentType);
  }
}

function buildDataUri(buffer: ArrayBuffer, contentType: string): string {
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
}
