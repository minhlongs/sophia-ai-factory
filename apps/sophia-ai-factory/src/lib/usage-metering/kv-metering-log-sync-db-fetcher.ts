/**
 * DB-fallback fetcher for metering logs (KV range queries are not efficient).
 * @module usage-metering/kv-metering-log-sync-db-fetcher
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { MeteringLogEntry } from './kv-metering-log-sync-types'

interface MeteringLogRow {
  id: string;
  user_id: string;
  license_nonce: string;
  service_name: string;
  endpoint: string | null;
  action: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  idempotency_key: string;
  request_id: string | null;
  tier_at_request: string;
  external_customer_id: string | null;
  model_name: string | null;
  created_at: number;
}

export async function getMeteringLogs(
  startTime: number,
  endTime: number,
  options?: { licenseNonce?: string; userId?: string; service?: string },
): Promise<MeteringLogEntry[]> {
  try {
    logger.debug('[KV Metering Logs] Fetching logs', {
      startTime: new Date(startTime * 1000).toISOString(),
      endTime: new Date(endTime * 1000).toISOString(),
      ...options,
    })
    logger.warn('[KV Metering Logs] Range query not efficient in KV, using database fallback')
    const db = createServerClient()
    const { data, error } = await db
      .from('usage_events')
      .select('*')
      .gte('created_at', startTime)
      .lte('created_at', endTime)
    if (error) throw new Error(`Database error: ${error.message}`)
    if (!data) return []
    return (data as unknown as MeteringLogRow[])
      .filter(row => {
        if (options?.licenseNonce && row.license_nonce !== options.licenseNonce) return false
        if (options?.userId && row.user_id !== options.userId) return false
        if (options?.service && row.service_name !== options.service) return false
        return true
      })
      .map(row => ({
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
      }))
  } catch (error) {
    logger.error('[KV Metering Logs] Failed to fetch logs', toError(error))
    return []
  }
}
