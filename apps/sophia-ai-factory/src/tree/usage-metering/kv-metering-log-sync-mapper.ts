/**
 * Row-to-Entry Mapper for KV Metering Log Sync
 *
 * Layer: tree/usage-metering
 *
 * @module usage-metering/kv-metering-log-sync-mapper
 */

import type { MeteringLogEntry } from './kv-metering-log-sync-types'

export interface UsageEventSyncRow {
  id: string
  user_id: string
  license_nonce: string
  service_name: string
  endpoint: string | null
  action: string
  credits_used: number
  tokens_input: number | null
  tokens_output: number | null
  idempotency_key: string
  request_id: string
  tier_at_request: string
  external_customer_id: string | null
  model_name: string
  created_at: number
}

export const USAGE_EVENTS_SYNC_COLUMNS = `
  id, user_id, license_nonce, service_name, endpoint, action,
  credits_used, tokens_input, tokens_output, idempotency_key,
  request_id, tier_at_request, external_customer_id, model_name, created_at
`

export function mapRowToMeteringLogEntry(row: UsageEventSyncRow): MeteringLogEntry {
  return {
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
}
