/**
 * Overage Top-Up Service
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/topup/overage-topup-service
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { markEventsAsBillable } from '@/seed/db/overage-billing-ops';
import { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops';
import {
  type TopupIpnPayload,
  TOPUP_PRICE_PER_MCU,
  UNDERPAYMENT_THRESHOLD,
  type ProcessTopupResult,
} from './types';
import {
  parseUserIdFromOrderId,
  grantUserCredits,
  getUnbilledOverageEventIds,
  resolveStaleLock,
} from './topup-calculator';

/**
 * Process a top-up IPN (Instant Payment Notification).
 *
 * Atomic lock via INSERT ON CONFLICT DO NOTHING on payment_events table.
 * Verifies payment amount, grants credits, marks overage events billable,
 * and invalidates quota cache.
 */
export async function processTopupIpn(
  ipn: TopupIpnPayload,
): Promise<ProcessTopupResult> {
  const { payment_id, payment_status, order_id, price_amount } = ipn;

  if (!order_id.startsWith('topup_')) {
    return { success: false, message: 'Not a top-up order' };
  }

  const eventId = `topup_${payment_id}_${payment_status}`;
  const db = createServerClient();
  const now = new Date().toISOString();

  // 1. Atomic lock via INSERT ON CONFLICT DO NOTHING
  const lockResult = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, `topup.${payment_status}`, JSON.stringify(ipn), now)
    .run();

  if (!lockResult.meta?.changes) {
    const existing = await db
      .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
      .bind(eventId)
      .first<{ processed: number | boolean; created_at: string }>();

    if (!existing) {
      return { success: false, message: 'Database query failure' };
    }

    if (existing.processed === 1) {
      return { success: true, message: 'Already processed' };
    }

    const { isStale } = await resolveStaleLock(db, eventId, existing.created_at, payment_id, now);
    if (isStale) {
      return { success: true, message: 'Stale lock cleared (marked processed)' };
    }

    return { success: false, message: 'Already processing' };
  }

  // 2. Lock owned — process the top-up
  try {
    if (payment_status !== 'finished') {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run();
      return { success: true, message: `Top-up ${payment_status} recorded` };
    }

    // 3. Underpayment guard
    const actuallyPaid = ipn.actually_paid;
    const required = price_amount * UNDERPAYMENT_THRESHOLD;
    if (actuallyPaid !== undefined && actuallyPaid !== null && actuallyPaid < required) {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run();

      logger.warn('[OverageTopup] Underpayment detected — no credits granted', {
        payment_id,
        priceAmount: price_amount,
        actuallyPaid,
        required,
      });
      return { success: false, message: 'Underpayment detected — insufficient funds' };
    }

    // 4. Resolve user & pending topup
    const userId = parseUserIdFromOrderId(order_id);
    if (!userId) {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run();
      return { success: false, message: 'Could not parse user ID from order' };
    }

    const ipnInvoiceId = ipn.invoice_id;
    const pendingTopupId = `topup_${ipnInvoiceId ?? payment_id}`;
    const pendingTopup = await db
      .prepare('SELECT id, user_id, mcu_amount, price_cents, status FROM pending_topups WHERE id = ?1')
      .bind(pendingTopupId)
      .first<{ id: string; user_id: string; mcu_amount: number; price_cents: number; status: string }>();

    if (!pendingTopup) {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run();
      logger.warn('[OverageTopup] Pending top-up not found, creating credit directly', {
        payment_id,
        userId,
      });
    }

    const mcuAmount = pendingTopup?.mcu_amount ?? Math.round(price_amount / TOPUP_PRICE_PER_MCU);

    // 5. Grant credits atomically
    await grantUserCredits(db, userId, mcuAmount);

    // 6. Mark pending top-up completed
    if (pendingTopup) {
      await db
        .prepare('UPDATE pending_topups SET status = ?1 WHERE id = ?2')
        .bind('completed', pendingTopup.id)
        .run();
    }

    // 7. Mark overage events billable
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

    // 8. Invalidate quota cache
    try {
      await invalidateQuotaCache(userId, userId);
    } catch {
      // Non-fatal — cache refreshed on next check
    }

    // 9. Mark event processed
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();

    logger.info('[OverageTopup] Top-up processed successfully', {
      userId,
      payment_id,
      mcuAmount,
    });

    return { success: true, message: 'Top-up processed' };
  } catch (error) {
    logger.error('[OverageTopup] Processing failed', toError(error));

    try {
      await db
        .prepare('DELETE FROM payment_events WHERE event_id = ?1')
        .bind(eventId)
        .run();
    } catch {
      // Non-fatal — lock release best-effort
    }

    return { success: false, message: error instanceof Error ? error.message : 'Processing failed' };
  }
}
