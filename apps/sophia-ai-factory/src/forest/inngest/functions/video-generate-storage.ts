/**
 * R2 storage upload and circuit-breaker protected download helpers for video generation.
 * @module forest/inngest/functions/video-generate-storage
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

export interface VideoBucketRef {
  bucket?: {
    put(
      key: string,
      data: ArrayBuffer,
      options?: { httpMetadata?: { contentType?: string } },
    ): Promise<unknown>;
  } | null;
}

export async function uploadBufferWithBucketGetter(
  getBucket: () => Promise<VideoBucketRef | null | undefined>,
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const ref = await getBucket();
  if (!ref?.bucket) {
    logger.warn('[videoGenerate] R2 bucket not available — skipping upload', { key });
    return;
  }
  await ref.bucket.put(key, data, { httpMetadata: { contentType } });
}

export async function downloadToBuffer(url: string): Promise<ArrayBuffer> {
  if (!shouldAllowRequest('video-download')) {
    throw new Error('[videoGenerate] Circuit breaker open for video-download — too many failures');
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      const kind = classifyHttpStatus(res.status);
      recordFailure('video-download', kind);
      throw new Error(`[videoGenerate] Failed to download from ${url}: ${res.status}`);
    }
    recordSuccess('video-download');
    return res.arrayBuffer();
  } catch (error) {
    if (error instanceof Error && error.message.includes('[videoGenerate] Failed to download from')) {
      throw error;
    }
    const kind = classifyError(error);
    recordFailure('video-download', kind);
    throw error;
  }
}
