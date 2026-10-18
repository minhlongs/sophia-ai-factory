/**
 * Locked Overage Top-Up Fulfillment & Refund Execution
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/topup/overage-topup-fulfillment
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
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
  finalizeOverageEventsAndCache,
  refundTopupCredits,
} from './overage-topup-helpers';
import { checkCryptoPaidAmount } from '../ipn-amount-check';
import { markTerminalIpnProcessed } from '../ipn-handlers/terminal-lock-manager';

export async function executeLockedTopupFulfillment(
  db: ReturnType<typeof createServerClient>,
  ipn: TopupIpnPayload,
  eventId: string,
  terminalStatus: 'finished' | 'refunded' | null,
): Promise<ProcessTopupResult> {
  const { payment_id, payment_status, order_id, price_amount } = ipn;

  if (payment_status === 'refunded') {
    const userId = parseUserIdFromOrderId(order_id);
    if (!userId) throw new Error('Could not parse user ID from top-up refund order');
    const pendingTopupId = `topup_${ipn.invoice_id ?? payment_id}`;
    const pendingTopup = await db
      .prepare('SELECT id, user_id, mcu_amount, status FROM pending_topups WHERE id = ?1')
      .bind(pendingTopupId)
      .first<{ id: string; user_id: string; mcu_amount: number; status: string }>();
    const finishedEvent = await db
      .prepare('SELECT processed FROM payment_events WHERE event_id = ?1')
      .bind(`topup_${payment_id}_finished`)
      .first<{ processed: number | boolean }>();
    const mcuAmount = pendingTopup?.mcu_amount ?? Math.round(price_amount / TOPUP_PRICE_PER_MCU);
    const creditsWereGranted = pendingTopup?.status === 'completed' || finishedEvent?.processed === 1;
    await refundTopupCredits(
      pendingTopup?.user_id ?? userId,
      mcuAmount,
      eventId,
      pendingTopup?.id,
      creditsWereGranted,
      ipn,
    );
    logger.info('[OverageTopup] Top-up refund processed', { userId, payment_id, mcuAmount, creditsWereGranted });
    return { success: true, message: 'Top-up refund processed' };
  }

  if (payment_status !== 'finished') {
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();
    return { success: true, message: `Top-up ${payment_status} recorded` };
  }

  const actuallyPaid = ipn.actually_paid;
  const amountCheck = checkCryptoPaidAmount(actuallyPaid, ipn.pay_amount, UNDERPAYMENT_THRESHOLD);
  if (amountCheck.status === 'missing-expected' || amountCheck.status === 'invalid' || amountCheck.status === 'underpaid') {
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();

    logger.warn('[OverageTopup] Underpayment detected — no credits granted', {
      payment_id,
      payAmount: ipn.pay_amount,
      payCurrency: ipn.pay_currency,
      actuallyPaid,
      required: amountCheck.status === 'underpaid' ? amountCheck.required : null,
    });
    if (terminalStatus) await markTerminalIpnProcessed(db, ipn, terminalStatus);
    return {
      success: false,
      message: amountCheck.status === 'underpaid'
        ? 'Underpayment detected — insufficient funds'
        : 'Paid amount cannot be verified — insufficient payment data',
    };
  }

  const userId = parseUserIdFromOrderId(order_id);
  if (!userId) {
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();
    return { success: false, message: 'Could not parse user ID from order' };
  }

  const pendingTopupId = `topup_${ipn.invoice_id ?? payment_id}`;
  const pendingTopup = await db
    .prepare('SELECT id, user_id, mcu_amount, price_cents, status FROM pending_topups WHERE id = ?1')
    .bind(pendingTopupId)
    .first<{ id: string; user_id: string; mcu_amount: number; price_cents: number; status: string }>();

  if (!pendingTopup) {
    throw new Error(`Pending top-up ${pendingTopupId} not found; cannot safely grant credits`);
  }

  const mcuAmount = pendingTopup.mcu_amount;
  await grantUserCredits(userId, mcuAmount, eventId, pendingTopup.id, ipn);
  await finalizeOverageEventsAndCache(userId);

  logger.info('[OverageTopup] Top-up processed successfully', { userId, payment_id, mcuAmount });
  return { success: true, message: 'Top-up processed' };
}
