/**
 * KV-level operations for metering log sync: markAsReconciled, getSyncStats.
 * @module usage-metering/kv-metering-log-sync-kv-operations
 */

import { getKvClient } from '@/seed/utils/redis-client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { DEFAULT_KV_METERING_LOG_CONFIG } from './kv-metering-log-sync-types'
import type { MeteringLogEntry } from './kv-metering-log-sync-types'

export function generateKvKey(event: { eventId: string; timestamp: number }): string {
  return `${DEFAULT_KV_METERING_LOG_CONFIG.kvKeyPrefix}${event.timestamp}:${event.eventId}`
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
    const existing = await kv.get<MeteringLogEntry>(kvKey)
    if (!existing) {
      logger.debug('[KV Metering Sync] Entry not found, skipping reconciliation mark', { eventId })
      return false
    }
    const entry: MeteringLogEntry = { ...existing, reconciledWithGateway: true }
    if (options?.discrepancy) entry.gatewayDiscrepancy = options.discrepancy
    await kv.set(kvKey, entry, {
      ex: DEFAULT_KV_METERING_LOG_CONFIG.ttlSeconds,
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
  // LIMITATION: KV list API not available on Cloudflare Workers KV — returns zeros until range-query support lands.
  return { totalKeys: 0, oldestTimestamp: null, newestTimestamp: null, reconciledCount: 0, discrepancyCount: 0 }
}
