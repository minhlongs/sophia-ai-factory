/**
 * In-Memory Edge Cache for Custom Domain Resolution
 *
 * @module tree/custom-domains/resolver/domain-cache
 */

import type { CacheEntry, TenantHostnameContext } from './types';

/** In-memory isolate cache for custom domain resolution (60s TTL) */
const DOMAIN_CACHE = new Map<string, CacheEntry>();
export const CACHE_TTL_MS = 60_000;
export const NEGATIVE_CACHE_TTL_MS = 10_000;
export const MAX_CACHE_SIZE = 500;

export function getCachedContext(hostname: string): TenantHostnameContext | null {
  const cached = DOMAIN_CACHE.get(hostname);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.context;
  }
  return null;
}

export function setInCache(key: string, context: TenantHostnameContext, ttlMs: number): void {
  if (DOMAIN_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = DOMAIN_CACHE.keys().next().value;
    if (oldestKey) DOMAIN_CACHE.delete(oldestKey);
  }
  DOMAIN_CACHE.set(key, {
    context,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clears the edge hostname resolution cache (useful for testing or domain updates).
 */
export function clearHostnameCache(): void {
  DOMAIN_CACHE.clear();
}
