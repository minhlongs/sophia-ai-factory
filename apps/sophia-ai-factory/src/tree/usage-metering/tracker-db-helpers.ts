/**
 * Usage Metering - Database Helper Functions
 *
 * Low-level DB operations for usage event tracking:
 * external customer ID resolution, idempotency key checking,
 * and usage event insertion.
 */

import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { insertTyped } from '@/seed/db/insert-typed';
import type { UsageEventInput, IngestionResult } from './types';
import type { D1Response } from '@/seed/db/types';
import { invalidateQuotaCache } from '@/tree/quota/quota-checker-kv-cache';
import { invalidateRealTimeCache } from '@/tree/usage-metering/realtime-tracker-kv-ops';

/**
 * Resolve the primary license nonce for a user.
 *
 * Returns the most recently created license nonce, or null if the user has
 * no license row. Used by billing/usage callers that need a license context
 * from a bare userId (e.g. image generation routes).
 */
export async function resolveUserLicenseNonce(userId: string): Promise<string | null> {
  try {
    const d1 = await getD1();
    if (!d1) {
      // Fallback to supabase-style client when D1 binding unavailable (tests).
      const db = createServerClient();
      const { data } = await db
        .from('raas_licenses')
        .select('nonce')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!data || typeof data !== 'object' || !('nonce' in data)) return null;
      return (data as { nonce: string }).nonce ?? null;
    }
    const row = await d1
      .prepare('SELECT nonce FROM raas_licenses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ nonce: string }>();
    return row?.nonce ?? null;
  } catch (error) {
    logger.debug('[resolveUserLicenseNonce] lookup failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Resolve external customer ID from license metadata
 *
 * Looks for stripe_customer_id in raas_licenses.metadata
 */
export async function resolveExternalCustomerId(licenseNonce: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data: license, error } = await db
      .from('raas_licenses')
      .select('metadata')
      .eq('nonce', licenseNonce)
      .single() as unknown as D1Response<{ metadata: Record<string, unknown> }>;

    if (error || !license) {
      logger.debug('[External Customer ID] License not found', { licenseNonce });
      return null;
    }

    const metadata = license.metadata as Record<string, unknown> | null;
    if (!metadata) {
      return null;
    }

    const externalId = typeof metadata.stripe_customer_id === 'string' ? metadata.stripe_customer_id : null;

    if (externalId) {
      logger.debug('[External Customer ID] Resolved', { licenseNonce, externalId, source: 'stripe' });
    }

    return externalId;
  } catch (error) {
    logger.error('[External Customer ID] Error resolving', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Check if idempotency key already exists in database
 *
 * @returns Existing record ID if found, null otherwise
 */
export async function checkIdempotencyKey(idempotencyKey: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('usage_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (error || !data) {
      return null;
    }

    if (data && typeof data === 'object' && 'id' in data && typeof (data as { id: unknown }).id === 'string') {
      return (data as { id: string }).id;
    }
    return null;
  } catch (error) {
    logger.error('[Idempotency Check] Error checking key', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

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
