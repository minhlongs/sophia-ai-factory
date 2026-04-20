/**
 * Usage KV Sync
 *
 * Batch ingestion of usage records with validation and quota enforcement.
 * Inserts accepted records into the usage_events table in bulk.
 *
 * @module usage-metering/usage-kv-sync
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { checkQuota } from './usage-rollup-engine';
import type { BatchUsageRecord, IngestionResult, BatchIngestionResponse, QuotaCheckResult, D1Response, LicenseMetadataRow } from './types';

/**
 * Validate a single batch usage record format
 */
function validateBatchRecord(record: BatchUsageRecord): { valid: boolean; error?: string } {
  if (!record.tenant_id || !record.license_nonce || !record.service || !record.action) {
    return { valid: false, error: 'Missing required fields: tenant_id, license_nonce, service, action' };
  }

  const validServices = ['heygen', 'elevenlabs', 'openrouter'];
  if (!validServices.includes(record.service)) {
    return { valid: false, error: `Invalid service: ${record.service}. Must be one of: ${validServices.join(', ')}` };
  }

  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 86400);
  if (record.timestamp > now) {
    return { valid: false, error: 'Timestamp cannot be in the future' };
  }
  if (record.timestamp < thirtyDaysAgo) {
    return { valid: false, error: 'Timestamp cannot be older than 30 days' };
  }

  if (record.consumed_units < 0 || record.request_count < 1) {
    return { valid: false, error: 'consumed_units must be >= 0, request_count must be >= 1' };
  }

  if (!record.feature_key.includes('.')) {
    return { valid: false, error: 'feature_key must be in format: service.action (e.g., heygen.createVideo)' };
  }

  return { valid: true };
}

/**
 * Batch ingest usage records with validation and quota enforcement
 *
 * @param records - Array of usage records to ingest
 * @param userId - User ID for validation (must match tenant_id owner)
 */
export async function batchIngestUsage(
  records: BatchUsageRecord[],
  userId: string
): Promise<BatchIngestionResponse> {
  const db = createServerClient();
  const results: IngestionResult[] = [];
  const acceptedRecords: Record<string, unknown>[] = [];
  const quotaCache = new Map<string, QuotaCheckResult>();

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

      // Step 2: Verify license
      const { data: license, error: licenseError } = await db
        .from('raas_licenses')
        .select('nonce, tier, is_revoked, created_by')
        .eq('nonce', record.license_nonce)
        .single() as unknown as D1Response<LicenseMetadataRow>;

      if (licenseError || !license) {
        result.error = 'License not found';
        result.reason = 'invalid_license';
        results.push(result);
        continue;
      }

      if (license.is_revoked) {
        result.error = 'License has been revoked';
        result.reason = 'invalid_license';
        results.push(result);
        continue;
      }

      const tier = license.tier || 'BASIC';

      // Step 3: Check quota (cache per license in batch)
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
      });

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

  // Step 5: Bulk insert accepted records
  if (acceptedRecords.length > 0) {
    const { error: insertError } = await db.from('usage_events').insert(acceptedRecords);

    if (insertError) {
      logger.error('[Batch Ingest] Failed to insert records', new Error(insertError.message));
      for (const r of results) {
        if (r.success) {
          r.success = false;
          r.error = 'Database insertion failed';
        }
      }
    }
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
