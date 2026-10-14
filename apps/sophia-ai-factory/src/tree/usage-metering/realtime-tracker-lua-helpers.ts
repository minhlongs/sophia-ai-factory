/**
 * Lua scripts, cache invalidation, and emergency bypass helpers for Real-Time Tracker KV ops.
 * @module tree/usage-metering/realtime-tracker-lua-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getKvClient } from '@/seed/utils/redis-client';
import type { RealTimeUsage } from './realtime-tracker-types';

export const ATOMIC_INCREMENT_EXPIRE_LUA = `
  local current = redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[2])
  redis.call('EXPIRE', KEYS[1], ARGV[3])
  return current
`;

export const ATOMIC_INCR_EXPIRE_LUA = `local key = KEYS[1]
local field = ARGV[1]
local delta = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
redis.call('HINCRBY', key, field, delta)
redis.call('EXPIRE', key, ttl)
return 1`;

export const ATOMIC_SET_EXPIRE_LUA = `redis.call('HSET', KEYS[1], ARGV[1], ARGV[2]); redis.call('EXPIRE', KEYS[1], ARGV[3]); return 1`;

export async function updateRealTimeUsage(usage: RealTimeUsage, ttlSeconds: number = 3600): Promise<void> {
  const kv = getKvClient();
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, skipping counter update');
    return;
  }
  try {
    const key = `usage:${usage.userId}:${usage.licenseNonce}`;
    const field = usage.windowStart.toString();
    const value = usage.currentCredits.toString();
    await kv.eval(ATOMIC_SET_EXPIRE_LUA, [key], [field, value, ttlSeconds.toString()]);
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis write error', toError(error));
  }
}

export async function invalidateRealTimeCache(userId: string, licenseNonce: string): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;
  try {
    await kv.del(`usage:${userId}:${licenseNonce}`);
    logger.debug('[Real-Time Tracker] Cache invalidated', {
      userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
    });
  } catch (error) {
    logger.error('[Real-Time Tracker] Cache invalidation error', toError(error));
  }
}

export function hasEmergencyBypass(requestHeaders: Headers): boolean {
  const bypassHeader = requestHeaders.get('x-emergency-bypass');
  const adminSecret = process.env.EMERGENCY_BYPASS_SECRET;
  if (!bypassHeader || !adminSecret) return false;
  return bypassHeader === adminSecret;
}
