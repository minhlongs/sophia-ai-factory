/**
 * Usage Metering Tracker
 *
 * Core tracking logic for AI service usage.
 * Re-exports DB helpers and credit utilities; orchestrates trackUsage.
 */

import { sha256 } from '@/tree/audit/crypto-utils';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { UsageEventInput, IngestionResult } from './types';
import { CREDIT_RULES } from './constants';
import { generateIdempotencyKey } from './idempotency';
import {
  resolveExternalCustomerId,
  checkIdempotencyKey,
  insertUsageEvent,
} from './tracker-db-helpers';

// Re-export DB helpers for consumers that import them from tracker
export { resolveExternalCustomerId, checkIdempotencyKey, insertUsageEvent } from './tracker-db-helpers';

/**
 * Track a usage event with idempotency protection
 *
 * Usage:
 * 1. Before API call: startTimer()
 * 2. Make API call
 * 3. After API call: trackUsage() with results
 */
export async function trackUsage(event: UsageEventInput): Promise<IngestionResult> {
  try {
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

    // Resolve external customer ID if not provided (for Stripe reconciliation)
    let externalCustomerId = event.externalCustomerId;
    if (!externalCustomerId) {
      externalCustomerId = await resolveExternalCustomerId(event.licenseNonce) || undefined;
    }

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

    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Calculate credits based on service rules
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
