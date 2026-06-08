/**
 * KV counter operations and emergency bypass for Real-Time Tracker
 * @module usage-metering/realtime-tracker-kv-ops
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { getKvClient } from '@/seed/utils/redis-client'
import type { RealTimeUsage } from './realtime-tracker-types'

export async function getRealTimeUsage(
  userId: string,
  licenseNonce: string,
  windowStart?: number
): Promise<RealTimeUsage | null> {
  const kv = getKvClient()
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, using DB fallback')
    return null
  }
  try {
    const ws = windowStart ?? Math.floor(Date.now() / 1000) * 1000
    const key = `usage:${userId}:${licenseNonce}`
    const cached = await kv.hget(key, ws.toString())
    if (cached === null || cached === undefined) {
      return null
    }
    return {
      userId,
      licenseNonce,
      tier: 'standard',
      currentCredits: typeof cached === 'number' ? cached : parseInt(cached as string, 10),
      windowStart: ws,
      windowMs: 1000,
    }
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis read error', toError(error))
    return null
  }
}

/**
 * Atomic increment + expire via Lua script (single round-trip to Upstash Redis).
 * Eliminates the hincrby-then-expire race where a connection drop after hincrby
 * leaves the key incremented but without TTL, causing ghost credits.
 */
const ATOMIC_INCREMENT_EXPIRE_LUA = `
  local current = redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[2])
  redis.call('EXPIRE', KEYS[1], ARGV[3])
  return current
`;

export async function atomicIncrementWithExpire(
  userId: string,
  licenseNonce: string,
  windowStart: number,
  creditsUsed: number,
  ttlSeconds: number = 3600,
): Promise<number> {
  const kv = getKvClient()
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, using DB fallback')
    return creditsUsed
  }
  try {
    const key = `usage:${userId}:${licenseNonce}`
    const result = await kv.eval(
      ATOMIC_INCREMENT_EXPIRE_LUA,
      [key],
      [windowStart.toString(), creditsUsed.toString(), ttlSeconds.toString()],
    )
    if (typeof result !== 'number') {
      throw new Error(`Unexpected eval result type: ${typeof result}`)
    }
    return result
  } catch (error) {
    logger.error('[Real-Time Tracker] Atomic increment error', toError(error))
    // Re-read current value to detect partial success before propagating error
    const key = `usage:${userId}:${licenseNonce}`
    try {
      const current = await kv.hget(key, windowStart.toString())
      if (current !== null && current !== undefined) {
        // Increment may have partially succeeded — return current value
        // so caller can make an informed decision rather than double-counting
        return typeof current === 'number' ? current : parseInt(current as string, 10)
      }
    } catch {
      // Cannot determine state — propagate original error
    }
    throw error
  }
}

/**
 * Lua script for atomic increment + expire on Redis hash field.
 * Eliminates TOCTOU between hincrby and expire in the REST API pipeline.
 * Upstash Redis executes pipeline commands sequentially over HTTP — if the
 * connection drops after hincrby succeeds but before expire, credits are
 * ghost-counted (key has no TTL). This Lua script guarantees both-or-neither.
 *
 * KEYS[1] = usage key (e.g. "usage:{userId}:{nonce}")
 * ARGV[1] = field (windowStart as string)
 * ARGV[2] = delta (credits used, positive integer)
 * ARGV[3] = ttl seconds
 */
const ATOMIC_INCR_EXPIRE_LUA = `local key = KEYS[1]
local field = ARGV[1]
local delta = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
redis.call('HINCRBY', key, field, delta)
redis.call('EXPIRE', key, ttl)
return 1`;

export async function incrementRealTimeUsage(
  userId: string,
  licenseNonce: string,
  windowStart: number,
  creditsUsed: number,
  ttlSeconds: number = 3600,
): Promise<number> {
  const kv = getKvClient()
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, fallback to basic increment')
    return creditsUsed
  }
  try {
    const key = `usage:${userId}:${licenseNonce}`
    const field = windowStart.toString()
    // Atomic increment + expire via Lua — eliminates pipeline TOCTOU
    const result = await kv.eval(ATOMIC_INCR_EXPIRE_LUA, [key], [field, creditsUsed.toString(), ttlSeconds.toString()])
    if (result !== 1) {
      throw new Error(`Unexpected Lua eval result: ${result}`)
    }
    // Read back the current value after atomic increment
    const current = await kv.hget(key, field)
    const currentNum = typeof current === 'number' ? current : parseInt(current as string, 10)
    if (isNaN(currentNum)) {
      throw new Error(`Could not read incremented value for ${key}:${field}`)
    }
    return currentNum
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis atomic increment error', toError(error))
    throw error
  }
}

export async function updateRealTimeUsage(usage: RealTimeUsage, ttlSeconds: number = 3600): Promise<void> {
  const kv = getKvClient()
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, skipping counter update')
    return
  }
  try {
    const key = `usage:${usage.userId}:${usage.licenseNonce}`
    await kv.hset(key, { [usage.windowStart.toString()]: usage.currentCredits })
    await kv.expire(key, ttlSeconds)
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis write error', toError(error))
  }
}

export async function invalidateRealTimeCache(userId: string, licenseNonce: string): Promise<void> {
  const kv = getKvClient()
  if (!kv) return
  try {
    await kv.del(`usage:${userId}:${licenseNonce}`)
    logger.debug('[Real-Time Tracker] Cache invalidated', {
      userId, licenseNonce: licenseNonce.slice(0, 8) + '...',
    })
  } catch (error) {
    logger.error('[Real-Time Tracker] Cache invalidation error', toError(error))
  }
}

export function hasEmergencyBypass(requestHeaders: Headers): boolean {
  const bypassHeader = requestHeaders.get('x-emergency-bypass')
  const adminSecret = process.env.EMERGENCY_BYPASS_SECRET
  if (!bypassHeader || !adminSecret) return false
  return bypassHeader === adminSecret
}
