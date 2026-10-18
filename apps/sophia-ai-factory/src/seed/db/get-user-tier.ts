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
import { getD1 } from '@/seed/db/client';
import {
  getKvBinding,
  getFromL1Cache,
  getFromKvCache,
  cacheAndReturnTier,
  invalidateUserTierCache,
  clearUserTierCache,
  normalizePlanToTier,
} from './user-tier-cache';

export { invalidateUserTierCache, clearUserTierCache, normalizePlanToTier };

export async function getUserTier(userId: string): Promise<Tier> {
  if (!userId) return 'BASIC' as Tier;

  // 1. L1 In-memory cache
  const l1Cached = getFromL1Cache(userId);
  if (l1Cached) return l1Cached;

  // 2. L2 KV cache
  const kv = getKvBinding();
  const kvCached = await getFromKvCache(userId, kv);
  if (kvCached) return kvCached;

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

    const rawUserTier = userSub?.tier ?? userSub?.plan;
    if (rawUserTier) {
      return cacheAndReturnTier(userId, normalizePlanToTier(rawUserTier), kv);
    }

    // Fallback: org-based lookup (BC for org-scoped customers)
    const member = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ org_id: string }>();
    if (!member) {
      return cacheAndReturnTier(userId, 'BASIC' as Tier, kv);
    }

    const orgSub = await d1
      .prepare("SELECT plan FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1")
      .bind(member.org_id)
      .first<{ plan: string }>();

    return cacheAndReturnTier(userId, normalizePlanToTier(orgSub?.plan), kv);
  } catch {
    return 'BASIC' as Tier;
  }
}
