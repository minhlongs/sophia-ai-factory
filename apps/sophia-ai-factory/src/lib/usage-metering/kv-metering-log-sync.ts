/**
 * KV Metering Log Sync Service
 *
 * Syncs usage events from database to Cloudflare KV for RaaS Gateway reconciliation.
 *
 * Sub-modules:
 *   kv-metering-log-sync-types.ts         — interfaces + DEFAULT_KV_METERING_LOG_CONFIG
 *   kv-metering-log-sync-kv-operations.ts — generateKvKey, markAsReconciled, getSyncStats
 *   kv-metering-log-sync-db-fetcher.ts    — getMeteringLogs (DB fallback)
 *
 * @module usage-metering/kv-metering-log-sync
 */

import { createServerClient } from '@/lib/db/client'
import { getKvClient } from '@/lib/redis'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import {
  DEFAULT_KV_METERING_LOG_CONFIG,
} from './kv-metering-log-sync-types'
import type {
  MeteringLogEntry, SyncResult, KvMeteringLogConfig,
} from './kv-metering-log-sync-types'
import { generateKvKey } from './kv-metering-log-sync-kv-operations'

export type { MeteringLogEntry, SyncResult, SyncError, KvMeteringLogConfig } from './kv-metering-log-sync-types'
export { DEFAULT_KV_METERING_LOG_CONFIG } from './kv-metering-log-sync-types'
export { markAsReconciled, getSyncStats } from './kv-metering-log-sync-kv-operations'
export { getMeteringLogs } from './kv-metering-log-sync-db-fetcher'

export async function syncUsageEventsToKv(
  config: KvMeteringLogConfig = DEFAULT_KV_METERING_LOG_CONFIG,
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true, eventsScanned: 0, eventsSynced: 0, eventsSkipped: 0, errors: [],
  }

  const kv = getKvClient()
  if (!kv) {
    logger.warn('[KV Metering Sync] KV client not available, skipping sync')
    return result
  }

  try {
    const db = createServerClient()
    const now = Math.floor(Date.now() / 1000)
    const startTime = now - (config.timeRangeHours * 60 * 60)

    logger.info('[KV Metering Sync] Fetching usage events', {
      timeRangeHours: config.timeRangeHours,
      startTime: new Date(startTime * 1000).toISOString(),
    })

    const { data: events, error } = await db
      .from('usage_events')
      .select(`
        id, user_id, license_nonce, service_name, endpoint, action,
        credits_used, tokens_input, tokens_output, idempotency_key,
        request_id, tier_at_request, external_customer_id, model_name, created_at
      `)
      .gte('created_at', startTime)
      .order('created_at', { ascending: true })
      .limit(config.batchSize)

    if (error) throw new Error(`Database error: ${error.message}`)
    if (!events || events.length === 0) {
      logger.info('[KV Metering Sync] No events to sync')
      return result
    }

    result.eventsScanned = events.length

    for (const row of events) {
      try {
        const kvKey = generateKvKey({ eventId: row.id, timestamp: row.created_at })
        const existing = await kv.get(kvKey)
        if (existing) { result.eventsSkipped++; continue }

        const entry: MeteringLogEntry = {
          eventId: row.id,
          userId: row.user_id,
          licenseNonce: row.license_nonce,
          service: row.service_name,
          endpoint: row.endpoint || 'unknown',
          action: row.action,
          creditsUsed: row.credits_used,
          tokensInput: row.tokens_input || 0,
          tokensOutput: row.tokens_output || 0,
          idempotencyKey: row.idempotency_key,
          requestId: row.request_id,
          tierAtRequest: row.tier_at_request,
          externalCustomerId: row.external_customer_id,
          modelName: row.model_name,
          timestamp: row.created_at,
          syncedAt: Date.now(),
          reconciledWithGateway: false,
        }

        await kv.put(kvKey, JSON.stringify(entry), { expirationTtl: config.ttlSeconds })
        result.eventsSynced++
        logger.debug('[KV Metering Sync] Event synced', { eventId: row.id, kvKey })
      } catch (error) {
        const err = toError(error)
        result.errors.push({ eventId: row.id, error: err.message, timestamp: Date.now() })
        logger.error('[KV Metering Sync] Failed to sync event', err, { eventId: row.id })
      }
    }

    logger.info('[KV Metering Sync] Sync completed', {
      scanned: result.eventsScanned, synced: result.eventsSynced,
      skipped: result.eventsSkipped, errors: result.errors.length,
    })
    return result
  } catch (error) {
    const err = toError(error)
    logger.error('[KV Metering Sync] Sync failed', err)
    result.success = false
    result.errors.push({ eventId: 'sync-batch', error: err.message, timestamp: Date.now() })
    return result
  }
}
