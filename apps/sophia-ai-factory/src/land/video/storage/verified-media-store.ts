/**
 * Verified media store for OPC execution artifacts.
 *
 * Unlike the campaign-flow storage (which falls back to the provider CDN URL
 * when R2 is unavailable), this path FAILS LOUD without R2: a `rendered` run
 * must always be backed by bytes we hold, checksummed, under a tenant-scoped
 * key. Temporary provider URLs expire and would silently break publisher proof.
 *
 * Layer: land/video (provider integration)
 * @module land/video/storage/verified-media-store
 */

import { getVideoBucket, tenantScopedKey } from './r2-binding';
import { sha256Hex } from '@/land/video/render/render-adapter';
import { logger } from '@/seed/utils/logger-utility';

export interface StoredVerifiedMedia {
  storageKey: string;
  byteSize: number;
  checksumSha256: string;
}

export interface MediaBucket {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
}

async function r2Bucket(): Promise<MediaBucket> {
  const r2 = await getVideoBucket();
  if (!r2) {
    throw new Error('VERIFIED_MEDIA_STORAGE_UNAVAILABLE: VIDEO_BUCKET binding not present');
  }
  return {
    put: async (key: string, body: Uint8Array, contentType: string) => {
      await r2.bucket.put(key, body, {
        httpMetadata: { contentType },
      });
    },
  };
}

/**
 * Persists verified bytes under `tenants/{tenantId}/videos/{runId}/final.mp4`
 * and returns the checksum computed FROM those bytes. The checksum is never
 * accepted from the caller.
 */
export async function storeVerifiedMedia(
  tenantId: string,
  runId: string,
  bytes: Uint8Array,
  bucket?: MediaBucket,
): Promise<StoredVerifiedMedia> {
  if (!tenantId || tenantId === 'default') {
    throw new Error('VERIFIED_MEDIA_TENANT_REQUIRED');
  }
  if (bytes.byteLength === 0) {
    throw new Error('VERIFIED_MEDIA_EMPTY_BYTES');
  }
  const storageKey = tenantScopedKey(tenantId, runId, 'final.mp4');
  const checksumSha256 = await sha256Hex(bytes);
  const target = bucket ?? (await r2Bucket());
  await target.put(storageKey, bytes, 'video/mp4');
  logger.info('[verified-media-store] Stored verified media', {
    tenantId,
    runId,
    byteSize: bytes.byteLength,
  });
  return { storageKey, byteSize: bytes.byteLength, checksumSha256 };
}
