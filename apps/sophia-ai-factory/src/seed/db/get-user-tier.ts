/**
 * Get user's subscription tier from D1.
 * Reads 'plan' column from subscriptions table (stored lowercase per
 * migration 0001) and normalizes via DB_TIER_MAPPING to the uppercase
 * Tier enum. Returns 'BASIC' on any miss.
 *
 * Implements high-frequency query caching:
 * - L1: In-memory Map cache with TTL (60s)
 * - L2: Cloudflare KV (KV_KV) with TTL (60s) when available
 */

import { Tier } from '@/seed/types';
import { DB_TIER_MAPPING } from '@/seed/config/tiers';
import { getD1 } from '@/seed/db/client';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const USER_TIER_CACHE = new Map<string, CacheEntry<Tier>>();
const CACHE_TTL_MS = 60_000;
const KV_TTL_SECONDS = 60;
const MAX_CACHE_SIZE = 1000;

function getKvBinding(): KVNamespace | null {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>;
    if (g.KV_KV) return g.KV_KV as KVNamespace;
    const env = (g as Record<string, Record<string, unknown>>).__env__;
    if (env?.KV_KV) return env.KV_KV as KVNamespace;
  }
  return null;
}

function setInL1Cache(userId: string, tier: Tier, ttlMs = CACHE_TTL_MS): void {
  if (USER_TIER_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = USER_TIER_CACHE.keys().next().value;
    if (oldestKey) USER_TIER_CACHE.delete(oldestKey);
  }
  USER_TIER_CACHE.set(userId, {
    value: tier,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateUserTierCache(userId: string): void {
  USER_TIER_CACHE.delete(userId);
  const kv = getKvBinding();
  if (kv) {
    kv.delete(`user_tier:${userId}`).catch(() => {});
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
  // Direct uppercase match first (tier column stores uppercase enum)
  const upper = plan.toUpperCase() as Tier;
  if (upper === 'BASIC' || upper === 'PREMIUM' || upper === 'ENTERPRISE' || upper === 'MASTER') {
    return upper;
  }
  // Fallback: lowercase alias map ('pro' → 'PREMIUM', 'master' → 'MASTER', etc.)
  return DB_TIER_MAPPING[plan.toLowerCase()] ?? ('BASIC' as Tier);
}

export async function getUserTier(userId: string): Promise<Tier> {
  if (!userId) return 'BASIC' as Tier;

  // 1. L1 In-memory cache
  const cached = USER_TIER_CACHE.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // 2. L2 KV cache
  const kv = getKvBinding();
  if (kv) {
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
  }

  try {
    const d1 = await getD1();
    if (!d1) return 'BASIC' as Tier;

    // Primary: user-scoped subscription (FREE100 customers have no org)
    const userSub = await d1
      .prepare(
        `SELECT tier, plan FROM subscriptions
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(userId)
      .first<{ tier: string | null; plan: string | null }>();

    if (userSub) {
      // tier column (uppercase) takes precedence over plan (lowercase alias)
      const raw = userSub.tier ?? userSub.plan;
      if (raw) {
        const tier = normalizePlanToTier(raw);
        setInL1Cache(userId, tier);
        if (kv) {
          kv.put(`user_tier:${userId}`, tier, { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
        }
        return tier;
      }
    }

    // Fallback: org-based lookup (BC for org-scoped customers)
    const member = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ org_id: string }>();
    if (!member) {
      setInL1Cache(userId, 'BASIC' as Tier);
      if (kv) {
        kv.put(`user_tier:${userId}`, 'BASIC', { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
      }
      return 'BASIC' as Tier;
    }

    const orgSub = await d1
      .prepare("SELECT plan FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1")
      .bind(member.org_id)
      .first<{ plan: string }>();

    const tier = normalizePlanToTier(orgSub?.plan);
    setInL1Cache(userId, tier);
    if (kv) {
      kv.put(`user_tier:${userId}`, tier, { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
    }
    return tier;
  } catch {
    return 'BASIC' as Tier;
  }
}
