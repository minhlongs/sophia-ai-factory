/**
 * Usage Metering - Usage Event Insertion Helper
 *
 * @module tree/usage-metering/tracker-insert-event
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { insertTyped } from '@/seed/db/insert-typed';
import type { UsageEventInput, IngestionResult } from './types';
import { invalidateQuotaCache } from '@/tree/quota/quota-checker-kv-cache';
import { invalidateRealTimeCache } from '@/tree/usage-metering/realtime-tracker-kv-ops';

/**
 * Insert usage event with idempotency protection
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING for atomic idempotency
 */
export async function insertUsageEvent(event: UsageEventInput & { idempotencyKey: string }): Promise<IngestionResult> {
  const db = createServerClient();
  const timestamp = event.createdAt ?? Math.floor(Date.now() / 1000);

  const dbEvent = {
    user_id: event.userId,
    license_key_hash: event.licenseKeyHash,
    license_nonce: event.licenseNonce,
    service_name: event.service,
    endpoint: event.endpoint,
    action: event.action,
    tokens_input: event.tokensInput ?? 0,
    tokens_output: event.tokensOutput ?? 0,
    credits_used: event.creditsUsed,
    request_id: event.requestId ?? null,
    model_name: event.modelName ?? null,
    tier_at_request: event.tierAtRequest,
    status_code: event.statusCode ?? null,
    error_message: event.errorMessage ?? null,
    response_time_ms: event.responseTimeMs ?? null,
    created_at: timestamp,
    idempotency_key: event.idempotencyKey,
    external_customer_id: event.externalCustomerId ?? null,
    resource_type: event.resourceType ?? null,
  };

  const { data, error } = await insertTyped(db.from('usage_events'), dbEvent)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        reason: 'duplicate',
        existingRecordId: error.message,
      };
    }
    logger.error('[Insert Usage Event] Database error', new Error(error.message));
    return {
      success: false,
      error: error.message,
    };
  }

  // Invalidate quota + realtime caches AFTER a usage event is successfully written
  // to D1. This is the correct place (#R2-16 fix): cache is stale only once actual
  // usage has been persisted, not on every quota check pass.
  invalidateQuotaCache(event.userId, event.licenseNonce).catch(() => {});
  invalidateRealTimeCache(event.userId, event.licenseNonce).catch(() => {});

  return {
    success: true,
    idempotencyKey: event.idempotencyKey,
    recordId: (data && typeof data === 'object' && 'id' in data && typeof (data as { id: unknown }).id === 'string')
      ? (data as { id: string }).id
      : undefined,
  };
}
