/**
 * Batch Usage Record Processor & KV Delta Accumulator
 *
 * Layer: tree/usage-metering/kv-sync
 *
 * @module usage-metering/kv-sync/batch-record-processor
 */

import { validateBatchRecord } from './d1-reconciler';
import type { BatchUsageRecord, IngestionResult } from '../types';
import type { KvCounterEntry } from './types';

/**
 * Validates record format, tenant ownership, and batch idempotency.
 * Returns null if valid, or a populated failed IngestionResult if rejected.
 */
export function validateRecordPreflight(
  record: BatchUsageRecord,
  index: number,
  userId: string,
  seenEventIds: Set<string>,
): IngestionResult | null {
  const validation = validateBatchRecord(record);
  if (!validation.valid) {
    return { index, success: false, error: validation.error, reason: 'validation_error' };
  }

  if (record.tenant_id !== userId) {
    return {
      index,
      success: false,
      error: 'Cross-tenant access forbidden: record tenant_id does not match authenticated user',
      reason: 'forbidden',
    };
  }

  if (record.event_id) {
    if (seenEventIds.has(record.event_id)) {
      return {
        index,
        success: false,
        error: 'Duplicate event: event_id already processed in this batch',
        reason: 'duplicate',
      };
    }
    seenEventIds.add(record.event_id);
  }

  return null;
}

/**
 * Formats a validated BatchUsageRecord into a D1 usage row payload.
 */
export function buildAcceptedUsageRow(
  record: BatchUsageRecord,
): Record<string, unknown> {
  return {
    user_id: record.tenant_id,
    license_key_hash: record.tenant_id,
    license_nonce: record.license_nonce,
    service_name: record.service,
    endpoint: `/${record.service}/${record.action}`,
    action: record.action,
    tokens_input: record.tokens_input || 0,
    tokens_output: record.tokens_output || 0,
    credits_used: record.consumed_units,
    status_code: record.status === 'success' ? 200 : 400,
    error_message: record.status === 'error' ? 'Client-reported error' : null,
    response_time_ms: record.response_time_ms ?? null,
    created_at: record.timestamp,
    idempotency_key: record.event_id ?? null,
  };
}

/**
 * Accumulates KV counter delta in memory per (tenant_id, service) pair.
 */
export function accumulateKvCounterDelta(
  kvBuffer: Map<string, KvCounterEntry>,
  record: BatchUsageRecord,
): void {
  const kvKey = `${record.tenant_id}:${record.service}`;
  const existing = kvBuffer.get(kvKey);
  if (existing) {
    existing.totalCredits += record.consumed_units;
    existing.totalRequests += record.request_count;
    existing.lastSeenAt = Math.max(existing.lastSeenAt, record.timestamp);
  } else {
    kvBuffer.set(kvKey, {
      userId: record.tenant_id,
      service: record.service,
      totalCredits: record.consumed_units,
      totalRequests: record.request_count,
      lastSeenAt: record.timestamp,
    });
  }
}
