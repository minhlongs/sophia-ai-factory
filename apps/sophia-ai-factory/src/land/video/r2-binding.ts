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

/**
 * Build a tenant-scoped R2 object key for a video job stage.
 * Pattern: tenants/{tenantId}/videos/{jobId}/{stage}
 *
 * @param tenantId - The tenant identifier
 * @param jobId    - The video job UUID
 * @param stage    - Stage name, e.g. 'audio.wav', 'visual.mp4', 'final.mp4'
 */
export function tenantScopedKey(
  tenantId: string,
  jobId: string,
  stage: string,
): string {
  return `tenants/${tenantId}/videos/${jobId}/${stage}`;
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
