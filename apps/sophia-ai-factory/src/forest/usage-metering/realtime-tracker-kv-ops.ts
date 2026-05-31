/**
 * KV counter operations and emergency bypass for Real-Time Tracker
 * @module usage-metering/realtime-tracker-kv-ops
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { getKvClient } from '@/lib/redis'
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
    const p = kv.pipeline()
    p.hincrby(key, field, creditsUsed)
    p.expire(key, ttlSeconds)
    const results = await p.exec()
    if (!results || results.length === 0) {
      throw new Error('Pipeline execution returned no results')
    }
    return results[0] as number
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis increment error', toError(error))
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
