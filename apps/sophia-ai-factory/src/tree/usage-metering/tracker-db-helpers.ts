/**
 * Usage Metering - Database Helper Functions
 *
 * Low-level DB operations for usage event tracking:
 * external customer ID resolution, idempotency key checking,
 * and usage event insertion.
 */

import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Response } from '@/seed/db/types';
import { insertUsageEvent } from './tracker-insert-event';

export { insertUsageEvent };

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
