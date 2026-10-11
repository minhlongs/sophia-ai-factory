/**
 * D1 Usage Reconciler & Validator
 *
 * @module usage-metering/kv-sync/d1-reconciler
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Response } from '@/seed/db/types';
import type { BatchUsageRecord, LicenseMetadataRow, IngestionResult } from './types';

/**
 * Validate a single batch usage record format
 */
export function validateBatchRecord(record: BatchUsageRecord): { valid: boolean; error?: string } {
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
 * Persist accepted records into D1 usage_events table.
 */
export async function persistUsageRecords(
  acceptedRecords: Record<string, unknown>[],
  results: IngestionResult[],
): Promise<boolean> {
  if (acceptedRecords.length === 0) return true;

  const db = createServerClient();
  const { error: insertError } = await db.from('usage_events').insert(acceptedRecords);

  if (insertError) {
    logger.error('[Batch Ingest] Failed to insert records', new Error(insertError.message));
    for (const r of results) {
      if (r.success) {
        r.success = false;
        r.error = 'Database insertion failed';
      }
    }
    return false;
  }

  return true;
}

/**
 * Fetch and verify license for record nonce.
 */
export async function fetchLicense(nonce: string): Promise<{ license: LicenseMetadataRow | null; error?: string }> {
  const db = createServerClient();
  const { data: license, error: licenseError } = await db
    .from('raas_licenses')
    .select('nonce, tier, is_revoked, created_by')
    .eq('nonce', nonce)
    .single() as unknown as D1Response<LicenseMetadataRow>;

  if (licenseError || !license) {
    return { license: null, error: 'License not found' };
  }

  if (license.is_revoked) {
    return { license: null, error: 'License has been revoked' };
  }

  return { license };
}
