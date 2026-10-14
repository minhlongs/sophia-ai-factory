/**
 * Atomic payment_events lock acquisition and post-grant overage settlement helpers
 * for Overage Top-Up IPN processing.
 * @module land/billing/topup/overage-topup-helpers
 */

import type { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { markEventsAsBillable } from '@/seed/db/overage-billing-ops';
import { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops';
import {
  type TopupIpnPayload,
  TOPUP_PRICE_PER_MCU,
  type ProcessTopupResult,
} from './types';
import {
  getUnbilledOverageEventIds,
  resolveStaleLock,
} from './topup-calculator';

export async function acquireTopupEventLock(
  db: ReturnType<typeof createServerClient>,
  eventId: string,
  ipn: TopupIpnPayload,
  now: string,
): Promise<{ acquired: true } | { acquired: false; response: ProcessTopupResult }> {
  const { payment_id, payment_status } = ipn;
  const lockResult = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, `topup.${payment_status}`, JSON.stringify(ipn), now)
    .run();

  if (lockResult.meta?.changes) {
    return { acquired: true };
  }

  const existing = await db
    .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
    .bind(eventId)
    .first<{ processed: number | boolean; created_at: string }>();

  if (!existing) {
    return { acquired: false, response: { success: false, message: 'Database query failure' } };
  }

  if (existing.processed === 1) {
    return { acquired: false, response: { success: true, message: 'Already processed' } };
  }

  const { isStale } = await resolveStaleLock(db, eventId, existing.created_at, payment_id, now);
  if (isStale) {
    return {
      acquired: false,
      response: { success: true, message: 'Stale lock cleared (marked processed)' },
    };
  }

  return { acquired: false, response: { success: false, message: 'Already processing' } };
}

export async function finalizeOverageEventsAndCache(userId: string): Promise<void> {
  try {
    const overageEventIds = await getUnbilledOverageEventIds(userId);
    if (overageEventIds.length > 0) {
      await markEventsAsBillable(overageEventIds, TOPUP_PRICE_PER_MCU);
      logger.info('[OverageTopup] Overage events marked as billable', {
        userId,
        count: overageEventIds.length,
      });
    }
  } catch (err) {
    logger.warn('[OverageTopup] Failed to mark events billable (non-fatal)', toError(err));
  }

  try {
    await invalidateQuotaCache(userId, userId);
  } catch {
    // Non-fatal — cache refreshed on next check
  }
}
