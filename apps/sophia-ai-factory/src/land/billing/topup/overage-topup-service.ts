/**
 * Overage Top-Up Service
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/topup/overage-topup-service
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type TopupIpnPayload,
  TOPUP_PRICE_PER_MCU,
  UNDERPAYMENT_THRESHOLD,
  type ProcessTopupResult,
} from './types';
import {
  parseUserIdFromOrderId,
  grantUserCredits,
} from './topup-calculator';
import {
  acquireTopupEventLock,
  finalizeOverageEventsAndCache,
} from './overage-topup-helpers';

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
  const lockOutcome = await acquireTopupEventLock(db, eventId, ipn, now);
  if (!lockOutcome.acquired) {
    return lockOutcome.response;
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

    // 7 & 8. Mark overage events billable and invalidate quota cache
    await finalizeOverageEventsAndCache(userId);

    // 9. Mark event processed
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    logger.info('[OverageTopup] Top-up processed successfully', { userId, payment_id, mcuAmount });
    return { success: true, message: 'Top-up processed' };
  } catch (error) {
    logger.error('[OverageTopup] Processing failed', toError(error));
    try {
      await db.prepare('DELETE FROM payment_events WHERE event_id = ?1').bind(eventId).run();
    } catch {
      // Non-fatal — lock release best-effort
    }
    return { success: false, message: error instanceof Error ? error.message : 'Processing failed' };
  }
}
