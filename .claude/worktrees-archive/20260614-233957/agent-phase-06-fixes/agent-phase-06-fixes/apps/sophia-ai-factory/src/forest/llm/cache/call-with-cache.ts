/**
 * LLM Cache wrapper — Phase 4F.
 *
 * Three-line integration primitive: `await callWithCache(key, () => liveFetch())`.
 *
 * Transparent to disabled / empty-orgId / D1-outage cases — the inner
 * `lookupCache` + `writeCache` already short-circuit and swallow errors, so
 * this wrapper adds no failure modes beyond the live fetch itself.
 */

import {
  lookupCache,
  writeCache,
  type CacheKey,
  type CacheEntry,
} from './llm-cache'

export interface CallWithCacheResult extends CacheEntry {
  /** True iff the response came from the cache (live fetch skipped). */
  fromCache: boolean
}

/**
 * Look the request up in the cache; on miss, run `fetchLive`, write the
 * result back to the cache, and return it.
 *
 * - Cache misses, disabled env (`LLM_CACHE_ENABLED` != '1'), empty orgId
 *   and D1 failures all fall through to `fetchLive` with no error surface.
 * - `writeCache` is awaited (already swallows errors internally); write
 *   latency is ~50ms on D1 and only hit on cold keys, so the cost is
 *   bounded and deterministic for tests.
 * - `fetchLive` errors propagate to the caller — we never cache failures.
 */
export async function callWithCache(
  key:       CacheKey,
  fetchLive: () => Promise<CacheEntry>,
): Promise<CallWithCacheResult> {
  const cached = await lookupCache(key)
  if (cached) {
    return { ...cached, fromCache: true }
  }

  const live = await fetchLive()
  await writeCache(key, live)
  return { ...live, fromCache: false }
}
