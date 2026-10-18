/**
 * Usage Metering Tracker
 *
 * Core tracking logic for AI service usage.
 * Re-exports DB helpers and credit utilities; orchestrates trackUsage.
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { UsageEventInput, IngestionResult } from './types';
import { generateIdempotencyKey } from './idempotency';
import {
  resolveExternalCustomerId,
  checkIdempotencyKey,
  insertUsageEvent,
} from './tracker-db-helpers';
import {
  calculateCredits,
  hashLicenseKey,
  startTimer,
} from './tracker-credit-calculator';

// Re-export DB helpers and credit utilities for consumers that import them from tracker
export { resolveExternalCustomerId, checkIdempotencyKey, insertUsageEvent } from './tracker-db-helpers';
export { calculateCredits, hashLicenseKey, startTimer };

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

    // Resolve external customer ID if not provided (for Stripe/Polar reconciliation)
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
