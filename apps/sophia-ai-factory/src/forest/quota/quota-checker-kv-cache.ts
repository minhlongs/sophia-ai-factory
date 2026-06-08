import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getKvClient as getRedisClient } from '@/seed/utils/redis-client';
import type { CachedQuota } from './quota-checker-types';

/**
 * Atomic HINCRBY + EXPIRE Lua script for quota KV cache.
 * Eliminates the race where a connection drop between kv.set() and kv.expire()
 * leaves credits ghost-counted (key persisted but no TTL).
 *
 * KEYS[1] = quota key (e.g. "quota:{userId}:{nonce}")
 * ARGV[1] = field (windowStart as string)
 * ARGV[2] = delta (credits to increment)
 * ARGV[3] = ttl seconds
 */
const ATOMIC_INCREMENT_EXPIRE_LUA = `local key = KEYS[1]
local field = ARGV[1]
local delta = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
redis.call('HINCRBY', key, field, delta)
redis.call('EXPIRE', key, ttl)
return 1`;

/**
 * Atomically increment quota fields and refresh TTL in a single Redis round-trip.
 * Uses Upstash Redis (via @/seed/utils/redis-client) which supports Lua eval — guarantees
 * HINCRBY + EXPIRE are both-or-neither. Falls back to fail-open on unavailability.
 */
export async function atomicIncrementQuota(
  userId: string,
  licenseNonce: string,
  windowStart: number,
  requestedCredits: number,
  ttlSeconds: number = 3600,
): Promise<void> {
  const kv = getRedisClient();
  if (!kv) {
    logger.debug('[Quota Checker] Redis not available, skipping atomic increment');
    return;
  }
  try {
    const key = `quota:${userId}:${licenseNonce}`;
    await kv.eval(
      ATOMIC_INCREMENT_EXPIRE_LUA,
      [key],
      [windowStart.toString(), requestedCredits.toString(), ttlSeconds.toString()],
    );
  } catch (error) {
    // Fail-open: quota check already passed; a cache write failure must not
    // block the request. Log for observability.
    logger.error('[Quota Checker] Atomic Redis increment failed', toError(error));
  }
}

// ---------------------------------------------------------------------------
// FIX-8: Quota counter reset
// ---------------------------------------------------------------------------

/**
 * Reset all hourly/daily/monthly credit counters for a given license nonce.
 * Zeros the cached usage in Redis so the next check starts from a clean slate.
 *
 * Called by: /api/cron/reset-quotas route (hourly or daily schedule).
 */
export async function resetQuotaCounters(
  userId: string,
  licenseNonce: string,
): Promise<void> {
  const kv = getRedisClient();
  if (!kv) {
    logger.debug('[Quota Checker] Redis not available, skipping quota reset');
    return;
  }
  try {
    const key = `quota:${userId}:${licenseNonce}`;
    // Overwrite with all zeros + refresh TTL so cache stays alive
    const zeroed: CachedQuota = { hourly: 0, daily: 0, monthly: 0, requests: 0, timestamp: Date.now() };
    await kv.set(key, zeroed as unknown as Parameters<typeof kv.set>[1]);
    logger.info('[Quota Checker] Counters reset', { userId: userId.slice(0, 8), licenseNonce: licenseNonce.slice(0, 8) });
  } catch (error) {
    logger.error('[Quota Checker] Quota reset failed', toError(error));
  }
}

// ---------------------------------------------------------------------------
// KV helpers
// ---------------------------------------------------------------------------

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
