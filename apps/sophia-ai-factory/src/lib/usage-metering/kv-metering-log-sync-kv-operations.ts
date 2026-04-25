/**
 * KV-level operations for metering log sync: markAsReconciled, getSyncStats.
 * @module usage-metering/kv-metering-log-sync-kv-operations
 */

import { getKvClient } from '@/lib/redis'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import { createHash } from 'crypto'
import { DEFAULT_KV_METERING_LOG_CONFIG } from './kv-metering-log-sync-types'
import type { MeteringLogEntry } from './kv-metering-log-sync-types'

export function generateKvKey(event: { eventId: string; timestamp: number }): string {
  return `${DEFAULT_KV_METERING_LOG_CONFIG.kvKeyPrefix}${event.timestamp}:${event.eventId}`
}

export function generateEventHash(event: {
  userId: string;
  licenseNonce: string;
  service: string;
  creditsUsed: number;
  timestamp: number;
}): string {
  const payload = `${event.userId}:${event.licenseNonce}:${event.service}:${event.creditsUsed}:${event.timestamp}`
  return createHash('sha256').update(payload).digest('hex')
}

export async function markAsReconciled(
  eventId: string,
  timestamp: number,
  options?: { discrepancy?: string },
): Promise<boolean> {
  const kv = getKvClient()
  if (!kv) {
    logger.warn('[KV Metering Sync] KV client not available')
    return false
  }
  try {
    const kvKey = generateKvKey({ eventId, timestamp })
    const existing = await kv.get(kvKey)
    if (!existing) {
      logger.debug('[KV Metering Sync] Entry not found, skipping reconciliation mark', { eventId })
      return false
    }
    const entry = JSON.parse(existing) as MeteringLogEntry
    entry.reconciledWithGateway = true
    if (options?.discrepancy) entry.gatewayDiscrepancy = options.discrepancy
    await kv.put(kvKey, JSON.stringify(entry), {
      expirationTtl: DEFAULT_KV_METERING_LOG_CONFIG.ttlSeconds,
    })
    logger.debug('[KV Metering Sync] Marked as reconciled', { eventId, hasDiscrepancy: !!options?.discrepancy })
    return true
  } catch (error) {
    logger.error('[KV Metering Sync] Failed to mark as reconciled', toError(error))
    return false
  }
}

export async function getSyncStats(): Promise<{
  totalKeys: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  reconciledCount: number;
  discrepancyCount: number;
}> {
  const kv = getKvClient()
  const empty = { totalKeys: 0, oldestTimestamp: null, newestTimestamp: null, reconciledCount: 0, discrepancyCount: 0 }
  if (!kv) return empty
  try {
    return empty
  } catch (error) {
    logger.error('[KV Metering Sync] Failed to get stats', toError(error))
    return empty
  }
}
