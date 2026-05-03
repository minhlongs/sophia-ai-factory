/**
 * KV counter operations and emergency bypass for Real-Time Tracker
 * @module usage-metering/realtime-tracker-kv-ops
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { getKvClient } from '@/lib/redis'
import type { RealTimeUsage } from './realtime-tracker-types'

export async function getRealTimeUsage(userId: string, licenseNonce: string): Promise<RealTimeUsage | null> {
  const kv = getKvClient()
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, using DB fallback')
    return null
  }
  try {
    const cached = await kv.get(`usage:${userId}:${licenseNonce}`)
    return cached ? (cached as RealTimeUsage) : null
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis read error', toError(error))
    return null
  }
}

export async function updateRealTimeUsage(usage: RealTimeUsage, ttlSeconds: number = 3600): Promise<void> {
  const kv = getKvClient()
  if (!kv) {
    logger.debug('[Real-Time Tracker] Redis not available, skipping counter update')
    return
  }
  try {
    await kv.set(`usage:${usage.userId}:${usage.licenseNonce}`, usage, { ex: ttlSeconds })
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
