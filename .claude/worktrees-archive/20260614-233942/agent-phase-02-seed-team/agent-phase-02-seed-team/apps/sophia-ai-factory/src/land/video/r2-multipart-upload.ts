/**
 * R2 Multipart Upload Helper
 *
 * Streams large WAV buffers to R2.
 * - > 5MB: multipart upload (create → upload parts → complete)
 * - <= 5MB: single PUT for simplicity
 */

import { logger } from '@/seed/utils/logger-utility';

const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadToR2Params {
  bucket: R2Bucket;
  key: string;
  data: ArrayBuffer;
  contentType?: string;
  /**
   * Cache-Control header. Defaults to 1-year immutable when the key contains
   * a content hash, otherwise omitted. Override for signed/preview assets.
   */
  cacheControl?: string;
}

/** Default Cache-Control for hashed/immutable assets (final video, poster). */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Upload data to R2 using multipart for large files, single PUT for small.
 * Returns the final R2 key on success.
 */
export async function uploadToR2(params: UploadToR2Params): Promise<string> {
  const { bucket, key, data, contentType = 'audio/wav', cacheControl } = params;

  if (data.byteLength > MULTIPART_THRESHOLD_BYTES) {
    return uploadMultipart({ bucket, key, data, contentType, cacheControl });
  }

  const httpMetadata: R2HTTPMetadata = { contentType };
  if (cacheControl) httpMetadata.cacheControl = cacheControl;

  await bucket.put(key, data, { httpMetadata });
  logger.info('[R2Upload] Single PUT complete', { key, bytes: data.byteLength });
  return key;
}

async function uploadMultipart(params: Required<Omit<UploadToR2Params, 'cacheControl'>> & { cacheControl?: string }): Promise<string> {
  const { bucket, key, data, contentType, cacheControl } = params;
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (R2 minimum)

  const httpMetadata: R2HTTPMetadata = { contentType };
  if (cacheControl) httpMetadata.cacheControl = cacheControl;

  const multipart = await bucket.createMultipartUpload(key, {
    httpMetadata,
  });

  const parts: R2UploadedPart[] = [];
  let offset = 0;
  let partNumber = 1;

  while (offset < data.byteLength) {
    const end = Math.min(offset + CHUNK_SIZE, data.byteLength);
    const chunk = data.slice(offset, end);
    const uploaded = await multipart.uploadPart(partNumber, chunk);
    parts.push(uploaded);
    offset = end;
    partNumber++;
  }

  await multipart.complete(parts);
  logger.info('[R2Upload] Multipart complete', { key, parts: parts.length, bytes: data.byteLength });
  return key;
}
