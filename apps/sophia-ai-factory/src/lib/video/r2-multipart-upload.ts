/**
 * R2 Multipart Upload Helper
 *
 * Streams large WAV buffers to R2.
 * - > 5MB: multipart upload (create → upload parts → complete)
 * - <= 5MB: single PUT for simplicity
 */

import { logger } from '@/lib/utils/logger-utility';

const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadToR2Params {
  bucket: R2Bucket;
  key: string;
  data: ArrayBuffer;
  contentType?: string;
}

/**
 * Upload data to R2 using multipart for large files, single PUT for small.
 * Returns the final R2 key on success.
 */
export async function uploadToR2(params: UploadToR2Params): Promise<string> {
  const { bucket, key, data, contentType = 'audio/wav' } = params;

  if (data.byteLength > MULTIPART_THRESHOLD_BYTES) {
    return uploadMultipart({ bucket, key, data, contentType });
  }

  await bucket.put(key, data, { httpMetadata: { contentType } });
  logger.info('[R2Upload] Single PUT complete', { key, bytes: data.byteLength });
  return key;
}

async function uploadMultipart(params: Required<UploadToR2Params>): Promise<string> {
  const { bucket, key, data, contentType } = params;
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (R2 minimum)

  const multipart = await bucket.createMultipartUpload(key, {
    httpMetadata: { contentType },
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
