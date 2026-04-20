/**
 * Usage Metering Tracker
 *
 * Core tracking logic for AI service usage
 */

import { sha256 } from '@/lib/audit/crypto-utils';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { UsageEventInput, UsageEventDB, IngestionResult, D1Response } from './types';
import type { RaasLicense } from '@/lib/raas-schema';
import { CREDIT_RULES } from './constants';
import { generateIdempotencyKey } from './idempotency';

/**
 * Resolve external customer ID from license metadata
 *
 * Looks for polar_customer_id or stripe_customer_id in raas_licenses.metadata
 *
 * @param licenseNonce - License nonce to lookup
 * @returns External customer ID or null
 */
export async function resolveExternalCustomerId(licenseNonce: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data: license, error } = await db
      .from('raas_licenses')
      .select('metadata')
      .eq('nonce', licenseNonce)
      .single() as unknown as D1Response<Pick<RaasLicense, 'metadata'>>;

    if (error || !license) {
      logger.debug('[External Customer ID] License not found', { licenseNonce });
      return null;
    }

    const metadata = license.metadata as Record<string, unknown> | null;
    if (!metadata) {
      return null;
    }

    // Priority: polar_customer_id > stripe_customer_id
    const polarId = typeof metadata.polar_customer_id === 'string' ? metadata.polar_customer_id : null;
    const stripeId = typeof metadata.stripe_customer_id === 'string' ? metadata.stripe_customer_id : null;
    const externalId: string | null = polarId || stripeId;

    if (externalId) {
      logger.debug('[External Customer ID] Resolved', {
        licenseNonce,
        externalId,
        source: polarId ? 'polar' : 'stripe',
      });
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
 * @param idempotencyKey - Key to check
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
 *
 * @param event - Usage event with idempotency key
 * @returns IngestionResult with success status
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

  // Insert with idempotency key (unique constraint handles duplicates)
  const { data, error } = await db
    .from('usage_events')
    .insert(dbEvent as unknown as Record<string, unknown>)
    .select('id')
    .single();

  if (error) {
    // Check if it's a unique constraint violation (duplicate)
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

  return {
    success: true,
    idempotencyKey: event.idempotencyKey,
    recordId: (data && typeof data === 'object' && 'id' in data && typeof (data as { id: unknown }).id === 'string')
      ? (data as { id: string }).id
      : undefined,
  };
}

/**
 * Track a usage event with idempotency protection
 *
 * Usage:
 * 1. Before API call: startTimer()
 * 2. Make API call
 * 3. After API call: trackUsage() with results
 *
 * @param event - Usage event data
 * @returns IngestionResult with success status and idempotency info
 */
export async function trackUsage(event: UsageEventInput): Promise<IngestionResult> {
  try {
    // Generate idempotency key if not provided
    const idempotencyKey = event.idempotencyKey || generateIdempotencyKey({
      requestId: event.requestId,
      userId: event.userId,
      licenseNonce: event.licenseNonce,
      service: event.service,
      action: event.action,
      timestamp: event.createdAt ?? Date.now(),
    });

    // Check for duplicate (idempotency check)
    const existingId = await checkIdempotencyKey(idempotencyKey);
    if (existingId) {
      logger.debug('[Usage Metering] Duplicate event detected', {
        idempotencyKey,
        existingId
      });
      return {
        success: false,
        reason: 'duplicate',
        existingRecordId: existingId,
      };
    }

    // Resolve external customer ID if not provided (for Stripe/Polar reconciliation)
    let externalCustomerId = event.externalCustomerId;
    if (!externalCustomerId) {
      externalCustomerId = await resolveExternalCustomerId(event.licenseNonce) || undefined;
    }

    // Insert with idempotency protection
    const result = await insertUsageEvent({
      ...event,
      externalCustomerId,
      idempotencyKey,
    });

    logger.debug('[Usage Metering] Tracked usage', {
      service: event.service,
      action: event.action,
      credits: event.creditsUsed,
      idempotencyKey,
      externalCustomerId: externalCustomerId || 'not-linked',
    });

    return result;
  } catch (error) {
    logger.error('[Usage Metering] Critical error tracking usage', error instanceof Error ? error : new Error(String(error)));

    // Return failure result instead of throwing
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate credits based on service rules
 *
 * @param service - Service name (heygen, elevenlabs, openrouter)
 * @param action - Action name (createVideo, textToSpeech, chatCompletion)
 * @param tokensTotal - Total tokens for token-based billing
 * @param tier - User tier for rate multiplier
 */
export function calculateCredits(
  service: string,
  action: string,
  tokensTotal?: number,
  tier: string = 'BASIC'
): number {
  const rules = CREDIT_RULES[service];
  if (!rules) return 1;

  const rule = rules[action] || rules.default;

  let baseCredits: number;

  if (rule.type === 'per-call') {
    baseCredits = rule.credits ?? 1;
  } else if (rule.type === 'per-1k-tokens' && tokensTotal) {
    baseCredits = Math.ceil(tokensTotal / 1000) * (rule.creditsPer1k ?? 1);
  } else {
    baseCredits = 1;
  }

  // Apply tier multiplier (lower tier = pay more)
  const tierMultiplier = getTierMultiplier(tier);
  return Math.ceil(baseCredits / tierMultiplier);
}

/**
 * Get tier rate multiplier
 */
function getTierMultiplier(tier: string): number {
  const multipliers: Record<string, number> = {
    BASIC: 1.0,
    PREMIUM: 0.8,
    ENTERPRISE: 0.6,
    MASTER: 0.5,
  };
  return multipliers[tier] ?? 1.0;
}

/**
 * Generate license key hash
 *
 * @param key - License key string
 */
export function hashLicenseKey(key: string): string {
  return sha256(key);
}

/**
 * Start a timer for response time tracking
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
