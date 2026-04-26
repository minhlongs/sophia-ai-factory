import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import type { CachedQuota } from './quota-checker-types';

function getKvClient() {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).KV_KV) {
    return (globalThis as Record<string, unknown>).KV_KV as NonNullable<typeof globalThis.KV_KV>;
  }
  return null;
}

/** Get cached usage from KV (fast path). Cache key: quota:{userId}:{licenseNonce} */
export async function getCachedUsage(
  userId: string,
  licenseNonce: string
): Promise<CachedQuota | null> {
  const kv = getKvClient();
  if (!kv) return null;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    return (await kv.get(key)) as unknown as CachedQuota | null;
  } catch (error) {
    logger.error('[Quota Checker] KV cache read error', toError(error));
    return null;
  }
}

/** Update cached usage in KV. TTL: 1 hour for hourly rolling window. */
export async function updateCachedUsage(
  userId: string,
  licenseNonce: string,
  usage: CachedQuota,
  ttlSeconds: number = 3600
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    await kv.set(key, usage as unknown as Parameters<typeof kv.set>[1], { expirationTtl: ttlSeconds });
  } catch (error) {
    logger.error('[Quota Checker] KV cache write error', toError(error));
  }
}

/** Invalidate quota cache (called after usage event ingestion). */
export async function invalidateQuotaCache(
  userId: string,
  licenseNonce: string
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    await kv.set(key, null as unknown as Parameters<typeof kv.set>[1]);
  } catch (error) {
    logger.error('[Quota Checker] Cache invalidation error', toError(error));
  }
}
