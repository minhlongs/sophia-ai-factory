/**
 * KV counter operations and emergency bypass for Real-Time Tracker
 * @module usage-metering/realtime-tracker-kv-ops
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getKvClient } from '@/seed/utils/redis-client';
import type { RealTimeUsage } from './realtime-tracker-types';
import {
  ATOMIC_INCREMENT_EXPIRE_LUA,
  ATOMIC_INCR_EXPIRE_LUA,
  updateRealTimeUsage,
  invalidateRealTimeCache,
  hasEmergencyBypass,
} from './realtime-tracker-lua-helpers';

export { updateRealTimeUsage, invalidateRealTimeCache, hasEmergencyBypass };

export async function getRealTimeUsage(
  userId: string,
  licenseNonce: string,
  windowStart?: number,
): Promise<RealTimeUsage | null> {
  const kv = getKvClient();
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, using DB fallback');
    return null;
  }
  try {
    const ws = windowStart ?? Math.floor(Date.now() / 1000) * 1000;
    const key = `usage:${userId}:${licenseNonce}`;
    const cached = await kv.hget(key, ws.toString());
    if (cached === null || cached === undefined) {
      return null;
    }
    return {
      userId,
      licenseNonce,
      tier: 'standard',
      currentCredits: typeof cached === 'number' ? cached : parseInt(cached as string, 10),
      windowStart: ws,
      windowMs: 1000,
    };
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis read error', toError(error));
    return null;
  }
}

export async function atomicIncrementWithExpire(
  userId: string,
  licenseNonce: string,
  windowStart: number,
  creditsUsed: number,
  ttlSeconds: number = 3600,
): Promise<number> {
  const kv = getKvClient();
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, using DB fallback');
    return creditsUsed;
  }
  try {
    const key = `usage:${userId}:${licenseNonce}`;
    const result = await kv.eval(
      ATOMIC_INCREMENT_EXPIRE_LUA,
      [key],
      [windowStart.toString(), creditsUsed.toString(), ttlSeconds.toString()],
    );
    if (typeof result !== 'number') {
      throw new Error(`Unexpected eval result type: ${typeof result}`);
    }
    return result;
  } catch (error) {
    logger.error('[Real-Time Tracker] Atomic increment error', toError(error));
    const key = `usage:${userId}:${licenseNonce}`;
    try {
      const current = await kv.hget(key, windowStart.toString());
      if (current !== null && current !== undefined) {
        return typeof current === 'number' ? current : parseInt(current as string, 10);
      }
    } catch {
      // Cannot determine state — propagate original error
    }
    throw error;
  }
}

export async function incrementRealTimeUsage(
  userId: string,
  licenseNonce: string,
  windowStart: number,
  creditsUsed: number,
  ttlSeconds: number = 3600,
): Promise<number> {
  const kv = getKvClient();
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, fallback to basic increment');
    return creditsUsed;
  }
  try {
    const key = `usage:${userId}:${licenseNonce}`;
    const field = windowStart.toString();
    const result = await kv.eval(
      ATOMIC_INCR_EXPIRE_LUA,
      [key],
      [field, creditsUsed.toString(), ttlSeconds.toString()],
    );
    if (result !== 1) {
      throw new Error(`Unexpected Lua eval result: ${result}`);
    }
    const current = await kv.hget(key, field);
    const currentNum = typeof current === 'number' ? current : parseInt(current as string, 10);
    if (isNaN(currentNum)) {
      throw new Error(`Could not read incremented value for ${key}:${field}`);
    }
    return currentNum;
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis atomic increment error', toError(error));
    throw error;
  }
}
