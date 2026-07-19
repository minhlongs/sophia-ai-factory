/**
 * Quota cache operations.
 *
 * Moved from forest/quota/quota-checker-kv-cache.ts to seed/ per layer architecture:
 * cache invalidation is a foundational data operation, not infrastructure orchestration.
 *
 * @module seed/kv/quota-cache-ops
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'

/** Get Cloudflare KV binding from global scope */
function getKvBinding(): KVNamespace | null {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).KV_KV) {
    return (globalThis as Record<string, unknown>).KV_KV as KVNamespace
  }
  return null
}

/**
 * Invalidate quota cache entry for a given user + license.
 * Called after top-up or usage event ingestion to force fresh quota check.
 */
export async function invalidateQuotaCache(
  userId: string,
  licenseNonce: string,
): Promise<void> {
  const kv = getKvBinding()
  if (!kv) return

  try {
    const key = `quota:${userId}:${licenseNonce}`
    await kv.delete(key)
  } catch (error) {
    logger.error('[Quota Cache] Cache invalidation error', toError(error))
  }
}
