/**
 * Usage KV Sync Service Operations
 *
 * @module usage-metering/kv-sync/usage-kv-sync-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { checkQuota } from '../usage-rollup-engine';
import { flushKvCounters } from './kv-batch-reader';
import { validateBatchRecord, persistUsageRecords, fetchLicense } from './d1-reconciler';
import type { BatchUsageRecord, IngestionResult, BatchIngestionResponse, QuotaCheckResult } from '../types';
import type { KvCounterEntry } from './types';

/**
 * Batch ingest usage records with validation and quota enforcement.
 * After D1 insert, KV counters are updated via a single batched flush
 * per unique (userId, service) pair — not one write per record.
 *
 * @param records - Array of usage records to ingest
 * @param userId - User ID for validation (must match tenant_id owner)
 * @param waitUntil - CF Workers execution context.waitUntil for non-blocking KV flush
 */
export async function batchIngestUsage(
  records: BatchUsageRecord[],
  userId: string,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<BatchIngestionResponse> {
  const results: IngestionResult[] = [];
  const acceptedRecords: Record<string, unknown>[] = [];
  const quotaCache = new Map<string, QuotaCheckResult>();
  const seenEventIds = new Set<string>();
  const kvBuffer = new Map<string, KvCounterEntry>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const result: IngestionResult = { index: i, success: false };

    try {
      // Step 1: Validate format
      const validation = validateBatchRecord(record);
      if (!validation.valid) {
        result.error = validation.error;
        result.reason = 'validation_error';
        results.push(result);
        continue;
      }

      // Step 1a: Tenant isolation validation
      if (record.tenant_id !== userId) {
        result.error = 'Cross-tenant access forbidden: record tenant_id does not match authenticated user';
        result.reason = 'forbidden';
        results.push(result);
        continue;
      }

      // Step 1b: Idempotency deduplication check
      if (record.event_id) {
        if (seenEventIds.has(record.event_id)) {
          result.error = 'Duplicate event: event_id already processed in this batch';
          result.reason = 'duplicate';
          results.push(result);
          continue;
        }
        seenEventIds.add(record.event_id);
      }

      // Step 2: Verify license
      const { license, error: licenseError } = await fetchLicense(record.license_nonce);
      if (licenseError || !license) {
        result.error = licenseError || 'License invalid';
        result.reason = 'invalid_license';
        results.push(result);
        continue;
      }

      const tier = license.tier || 'BASIC';

      // Step 3: Check quota
      const cacheKey = `${record.license_nonce}:${tier}`;
      let quotaResult = quotaCache.get(cacheKey);

      if (!quotaResult) {
        quotaResult = await checkQuota(record.tenant_id, record.license_nonce, tier, record.consumed_units);
        quotaCache.set(cacheKey, quotaResult);
      }

      if (!quotaResult.allowed) {
        result.error = `Quota exceeded: ${quotaResult.exceeded?.type}`;
        result.reason = 'quota_exceeded';
        result.quotaRemaining = quotaResult.remaining;
        results.push(result);
        continue;
      }

      // Step 4: Prepare for insertion
      acceptedRecords.push({
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
      });

      // Step 4b: Accumulate KV counter delta
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

      result.success = true;
      result.quotaRemaining = quotaResult.remaining;
      results.push(result);
      quotaCache.set(cacheKey, quotaResult);
    } catch (error) {
      logger.error('[Batch Ingest] Error processing record', error instanceof Error ? error : new Error(String(error)));
      result.error = 'Internal error during processing';
      results.push(result);
    }
  }

  // Step 5: Bulk insert accepted records into D1
  const persisted = await persistUsageRecords(acceptedRecords, results);
  if (!persisted) {
    kvBuffer.clear(); // clear buffer if insert failed
  }

  // Step 6: Flush KV counters
  if (kvBuffer.size > 0) {
    logger.debug('[Batch Ingest] Flushing KV counters', {
      recordCount: acceptedRecords.length,
      kvWriteCount: kvBuffer.size,
    });
    await flushKvCounters(kvBuffer, waitUntil);
  }

  const accepted = results.filter(r => r.success).length;
  const rejected = results.filter(r => !r.success).length;

  return {
    total: records.length,
    accepted,
    rejected,
    results,
    timestamp: new Date().toISOString(),
  };
}
