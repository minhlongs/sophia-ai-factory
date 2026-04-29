/**
 * R2 Bucket Binding Helper
 *
 * Retrieves the VIDEO_BUCKET R2 binding from Cloudflare Workers runtime context.
 * Returns null when running outside Cloudflare (local dev, test).
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';

export interface R2BucketRef {
  bucket: R2Bucket;
  publicBaseUrl: string | null;
}

export async function getVideoBucket(): Promise<R2BucketRef | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as { VIDEO_BUCKET?: R2Bucket }).VIDEO_BUCKET;
    const publicBaseUrl =
      (env as { R2_PUBLIC_BASE_URL?: string }).R2_PUBLIC_BASE_URL ?? null;
    if (!bucket) return null;
    return { bucket, publicBaseUrl };
  } catch {
    return null;
  }
}
