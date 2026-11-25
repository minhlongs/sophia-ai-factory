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

interface PendingTopupRow {
  id: string;
  user_id: string;
  mcu_amount: number;
  price_cents: number;
  status: string;
}

async function finalizeRejectedTopup(
  db: ReturnType<typeof createServerClient>,
  ipn: TopupIpnPayload,
  eventId: string,
  terminalStatus: 'finished' | 'refunded' | null,
  message: string,
): Promise<ProcessTopupResult> {
  await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
  if (terminalStatus) await markTerminalIpnProcessed(db, ipn, terminalStatus);
  return { success: false, message };
}

async function handleTopupRefund(
  db: ReturnType<typeof createServerClient>,
  ipn: TopupIpnPayload,
  eventId: string,
): Promise<ProcessTopupResult> {
  const userId = parseUserIdFromOrderId(ipn.order_id);
  if (!userId) throw new Error('Could not parse user ID from top-up refund order');
  const pendingTopupId = `topup_${ipn.invoice_id ?? ipn.payment_id}`;
  const pendingTopup = await db
    .prepare('SELECT id, user_id, mcu_amount, status FROM pending_topups WHERE id = ?1')
    .bind(pendingTopupId)
    .first<{ id: string; user_id: string; mcu_amount: number; status: string }>();
  const finishedEvent = await db
    .prepare('SELECT processed FROM payment_events WHERE event_id = ?1')
    .bind(`topup_${ipn.payment_id}_finished`)
    .first<{ processed: number | boolean }>();
  const mcuAmount = pendingTopup?.mcu_amount ?? Math.round(ipn.price_amount / TOPUP_PRICE_PER_MCU);
  const creditsWereGranted = pendingTopup?.status === 'completed' || finishedEvent?.processed === 1;
  await refundTopupCredits(
    pendingTopup?.user_id ?? userId,
    mcuAmount,
    eventId,
    pendingTopup?.id,
    creditsWereGranted,
    ipn,
  );
  logger.info('[OverageTopup] Top-up refund processed', {
    userId,
    payment_id: ipn.payment_id,
    mcuAmount,
    creditsWereGranted,
  });
  return { success: true, message: 'Top-up refund processed' };
}

function validatePendingTopupMatch(
  ipn: TopupIpnPayload,
  userId: string,
  pendingTopup: PendingTopupRow,
): string | null {
  if (pendingTopup.user_id !== userId) {
    logger.warn('[OverageTopup] Order user mismatch against pending_topups owner — rejecting', {
      payment_id: ipn.payment_id,
      parsedUserId: userId,
      topupUserId: pendingTopup.user_id,
    });
    return 'Top-up user mismatch against pending order owner';
  }

  if (typeof ipn.price_currency !== 'string' || ipn.price_currency.trim().toUpperCase() !== 'USD') {
    logger.warn('[OverageTopup] Non-USD fiat currency on top-up — rejecting', {
      payment_id: ipn.payment_id,
      priceCurrency: ipn.price_currency,
    });
    return 'Top-up price currency must be USD';
  }

  if (
    !Number.isFinite(ipn.price_amount) ||
    pendingTopup.price_cents <= 0 ||
    Math.abs(ipn.price_amount * 100 - pendingTopup.price_cents) > pendingTopup.price_cents * 0.01
  ) {
    logger.warn('[OverageTopup] Fiat price mismatch against pending_topups.price_cents — rejecting', {
      payment_id: ipn.payment_id,
      priceAmount: ipn.price_amount,
      expectedPriceCents: pendingTopup.price_cents,
    });
    return 'Top-up fiat price mismatch against authoritative pending top-up';
  }

  return null;
}

export async function executeLockedTopupFulfillment(
  db: ReturnType<typeof createServerClient>,
  ipn: TopupIpnPayload,
  eventId: string,
  terminalStatus: 'finished' | 'refunded' | null,
): Promise<ProcessTopupResult> {
  if (ipn.payment_status === 'refunded') {
    return handleTopupRefund(db, ipn, eventId);
  }

  if (ipn.payment_status !== 'finished') {
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    return { success: true, message: `Top-up ${ipn.payment_status} recorded` };
  }

  const amountCheck = checkCryptoPaidAmount(ipn.actually_paid, ipn.pay_amount, UNDERPAYMENT_THRESHOLD);
  if (amountCheck.status !== 'sufficient') {
    logger.warn('[OverageTopup] Crypto payment verification failed — no credits granted', {
      payment_id: ipn.payment_id,
      status: amountCheck.status,
      payAmount: ipn.pay_amount,
      payCurrency: ipn.pay_currency,
      actuallyPaid: ipn.actually_paid,
      required: amountCheck.status === 'underpaid' ? amountCheck.required : null,
    });
    const msg =
      amountCheck.status === 'underpaid'
        ? 'Underpayment detected — insufficient funds'
        : 'Paid amount cannot be verified — insufficient payment data';
    return finalizeRejectedTopup(db, ipn, eventId, terminalStatus, msg);
  }

  const userId = parseUserIdFromOrderId(ipn.order_id);
  if (!userId) {
    return finalizeRejectedTopup(db, ipn, eventId, terminalStatus, 'Could not parse user ID from order');
  }

  const pendingTopupId = `topup_${ipn.invoice_id ?? ipn.payment_id}`;
  const pendingTopup = await db
    .prepare('SELECT id, user_id, mcu_amount, price_cents, status FROM pending_topups WHERE id = ?1')
    .bind(pendingTopupId)
    .first<PendingTopupRow>();

  if (!pendingTopup) {
    throw new Error(`Pending top-up ${pendingTopupId} not found; cannot safely grant credits`);
  }

  const mismatchMsg = validatePendingTopupMatch(ipn, userId, pendingTopup);
  if (mismatchMsg) {
    return finalizeRejectedTopup(db, ipn, eventId, terminalStatus, mismatchMsg);
  }

  await grantUserCredits(userId, pendingTopup.mcu_amount, eventId, pendingTopup.id, ipn);
  await finalizeOverageEventsAndCache(userId);

  logger.info('[OverageTopup] Top-up processed successfully', {
    userId,
    payment_id: ipn.payment_id,
    mcuAmount: pendingTopup.mcu_amount,
  });
  return { success: true, message: 'Top-up processed' };
}
