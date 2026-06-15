/**
 * Dunning KV Cache Helpers
 *
 * KV-caches dunning state to avoid 2 D1 queries on every API request.
 * Dunning state changes rarely (only on payment fail/success).
 *
 * @module billing/dunning/dunning-kv-cache
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const DUNNING_CACHE_TTL_SECONDS = 300; // 5 minutes

export function getDunningKvClient() {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).KV_KV) {
    return (globalThis as Record<string, unknown>).KV_KV as NonNullable<typeof globalThis.KV_KV>;
  }
  return null;
}

/**
 * Invalidate dunning state KV cache for a license.
 * Call from dunning state transition handlers so the next API check
 * re-reads from D1 and gets the fresh state.
 */
export async function invalidateDunningCache(licenseNonce: string): Promise<void> {
  const kv = getDunningKvClient();
  if (!kv) return;
  try {
    await kv.set(`dunning:${licenseNonce}` as unknown as Parameters<typeof kv.set>[0], null as unknown as Parameters<typeof kv.set>[1]);
  } catch (err) {
    logger.error('[Dunning] KV cache invalidation error', toError(err));
  }
}
