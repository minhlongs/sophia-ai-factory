import type { CacheEntry } from './types';

const ORG_ID_CACHE = new Map<string, CacheEntry<string | null>>();
const ORG_OWNER_CACHE = new Map<string, CacheEntry<string | null>>();
export const ORG_ID_CACHE_TTL_MS = 60_000;
export const NEGATIVE_CACHE_TTL_MS = 10_000;
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

export function getFromL1OrgCache(userId: string): string | null | undefined {
  const cached = ORG_ID_CACHE.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  return undefined;
}

export function setInL1OrgCache(
  userId: string,
  orgId: string | null,
  ttlMs = orgId ? ORG_ID_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS,
): void {
  if (ORG_ID_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = ORG_ID_CACHE.keys().next().value;
    if (oldestKey) ORG_ID_CACHE.delete(oldestKey);
  }
  ORG_ID_CACHE.set(userId, {
    value: orgId,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateOrgIdCache(userId: string): void {
  ORG_ID_CACHE.delete(userId);
  const kv = getKvBinding();
  if (kv) {
    kv.delete(`org_id:${userId}`).catch(() => {});
  }
}

export function clearOrgIdCache(): void {
  ORG_ID_CACHE.clear();
  ORG_OWNER_CACHE.clear();
}
