import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getKvClient as getRedisClient } from '@/seed/utils/redis-client';
import type { CachedQuota } from './quota-checker-types';

const ATOMIC_INCREMENT_EXPIRE_LUA = `local key = KEYS[1]
local field = ARGV[1]
local delta = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
redis.call('HINCRBY', key, field, delta)
redis.call('EXPIRE', key, ttl)
return 1`;

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
    await kv.eval(ATOMIC_INCREMENT_EXPIRE_LUA, [key], [windowStart.toString(), requestedCredits.toString(), ttlSeconds.toString()]);
  } catch (error) {
    logger.error('[Quota Checker] Atomic Redis increment failed', toError(error));
  }
}

export async function resetQuotaCounters(userId: string, licenseNonce: string): Promise<void> {
  const kv = getRedisClient();
  if (!kv) {
    logger.debug('[Quota Checker] Redis not available, skipping quota reset');
    return;
  }
  try {
    const key = `quota:${userId}:${licenseNonce}`;
    const zeroed: CachedQuota = { hourly: 0, daily: 0, monthly: 0, requests: 0, timestamp: Date.now() };
    await kv.set(key, zeroed as unknown as Parameters<typeof kv.set>[1]);
    logger.info('[Quota Checker] Counters reset', { userId: userId.slice(0, 8), licenseNonce: licenseNonce.slice(0, 8) });
  } catch (error) {
    logger.error('[Quota Checker] Quota reset failed', toError(error));
  }
}

function getKvClient() {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).KV_KV) {
    return (globalThis as Record<string, unknown>).KV_KV as NonNullable<typeof globalThis.KV_KV>;
  }
  return null;
}

export async function getCachedUsage(userId: string, licenseNonce: string): Promise<CachedQuota | null> {
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

export { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops';
