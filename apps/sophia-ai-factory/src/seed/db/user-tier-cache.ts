/**
 * User tier invalidation and normalization helpers.
 * Tier authorization reads are D1-backed; KV is retained for invalidating
 * keys written by older deployments, but is not an entitlement source.
 * Layer: seed/db
 */

import { Tier } from '@/seed/types';
import { DB_TIER_MAPPING } from '@/seed/config/tiers';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const USER_TIER_CACHE = new Map<string, CacheEntry<Tier>>();
const CACHE_TTL_MS = 60_000;
export const KV_TTL_SECONDS = 60;
const MAX_CACHE_SIZE = 1000;

export function getKvBinding(): KVNamespace | null {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>;
    if (g.KV_KV) return g.KV_KV as KVNamespace;
    const env = (g as Record<string, Record<string, unknown>>).__env__;
    if (env?.KV_KV) return env.KV_KV as KVNamespace;
  }
  return null;
}

export function getFromL1Cache(userId: string): Tier | null {
  const cached = USER_TIER_CACHE.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  return null;
}

export function setInL1Cache(userId: string, tier: Tier, ttlMs = CACHE_TTL_MS): void {
  if (USER_TIER_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = USER_TIER_CACHE.keys().next().value;
    if (oldestKey) USER_TIER_CACHE.delete(oldestKey);
  }
  USER_TIER_CACHE.set(userId, {
    value: tier,
    expiresAt: Date.now() + ttlMs,
  });
}

export async function getFromKvCache(userId: string, kv: KVNamespace | null): Promise<Tier | null> {
  if (!kv) return null;
  try {
    const kvVal = await kv.get(`user_tier:${userId}`);
    if (kvVal) {
      const tier = normalizePlanToTier(kvVal);
      setInL1Cache(userId, tier);
      return tier;
    }
  } catch {
    // KV non-fatal, fallback to D1
  }
  return null;
}

export function cacheAndReturnTier(userId: string, tier: Tier, kv: KVNamespace | null): Tier {
  setInL1Cache(userId, tier);
  if (kv) {
    kv.put(`user_tier:${userId}`, tier, { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
  }
  return tier;
}

export function invalidateUserTierCache(userId: string): void {
  void invalidateUserTierCacheAsync(userId).catch(() => {});
}

/**
 * Invalidate both tier-cache layers and wait for KV deletion to finish.
 * Callers that acknowledge entitlement changes should use this variant so
 * other Worker isolates do not keep serving the old tier after success.
 */
export async function invalidateUserTierCacheAsync(userId: string): Promise<void> {
  USER_TIER_CACHE.delete(userId);
  const kv = getKvBinding();
  if (kv) {
    await kv.delete(`user_tier:${userId}`);
  }
}

export function clearUserTierCache(): void {
  USER_TIER_CACHE.clear();
}

/**
 * Normalize either a DB tier value (uppercase, e.g. 'MASTER') or a plan alias
 * (lowercase, e.g. 'master', 'pro') to the canonical Tier enum.
 * Unknown or null → 'BASIC'.
 */
export function normalizePlanToTier(plan: string | null | undefined): Tier {
  if (!plan) return 'BASIC' as Tier;
  const upper = plan.toUpperCase() as Tier;
  if (upper === 'BASIC' || upper === 'PREMIUM' || upper === 'ENTERPRISE' || upper === 'MASTER') {
    return upper;
  }
  return DB_TIER_MAPPING[plan.toLowerCase()] ?? ('BASIC' as Tier);
}
