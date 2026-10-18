/**
 * Usage KV Sync Service Operations
 *
 * @module usage-metering/kv-sync/usage-kv-sync-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { checkQuota } from '../usage-rollup-engine';
import { flushKvCounters } from './kv-batch-reader';
import { persistUsageRecords, fetchLicense } from './d1-reconciler';
import {
  validateRecordPreflight,
  buildAcceptedUsageRow,
  accumulateKvCounterDelta,
} from './batch-record-processor';
import type { BatchUsageRecord, IngestionResult, BatchIngestionResponse, QuotaCheckResult } from '../types';
import type { KvCounterEntry } from './types';

/**
 * Batch ingest usage records with validation and quota enforcement.
 * After D1 insert, KV counters are updated via a single batched flush
 * per unique (userId, service) pair — not one write per record.
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

    try {
      const preflightFailure = validateRecordPreflight(record, i, userId, seenEventIds);
      if (preflightFailure) {
        results.push(preflightFailure);
        continue;
      }

      const { license, error: licenseError } = await fetchLicense(record.license_nonce);
      if (licenseError || !license) {
        results.push({ index: i, success: false, error: licenseError || 'License invalid', reason: 'invalid_license' });
        continue;
      }

      const tier = license.tier || 'BASIC';
      const cacheKey = `${record.license_nonce}:${tier}`;
      const quotaResult = quotaCache.get(cacheKey)
        ?? await checkQuota(record.tenant_id, record.license_nonce, tier, record.consumed_units);
      quotaCache.set(cacheKey, quotaResult);

      if (!quotaResult.allowed) {
        results.push({
          index: i,
          success: false,
          error: `Quota exceeded: ${quotaResult.exceeded?.type}`,
          reason: 'quota_exceeded',
          quotaRemaining: quotaResult.remaining,
        });
        continue;
      }

      acceptedRecords.push(buildAcceptedUsageRow(record));
      accumulateKvCounterDelta(kvBuffer, record);
      results.push({ index: i, success: true, quotaRemaining: quotaResult.remaining });
    } catch (error) {
      logger.error('[Batch Ingest] Error processing record', error instanceof Error ? error : new Error(String(error)));
      results.push({ index: i, success: false, error: 'Internal error during processing' });
    }
  }

  const persisted = await persistUsageRecords(acceptedRecords, results);
  if (!persisted) {
    kvBuffer.clear();
  }

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
