/**
 * IPN dispatcher — routes `finished` and `refunded` events to the correct handler
 * (subscription OR one_time) based on invoice_id lookup.
 *
 * Zero regression: if lookupInvoice returns null or subscription kind,
 * existing handlers (handleFinished / handleRefunded) are called unchanged.
 *
 * @module billing/nowpayments-ipn-dispatch
 */

import { logger } from '@/seed/utils/logger-utility'
import { lookupInvoice } from '@/tree/clients/nowpayments-client'
import { handleFinished, handleRefunded } from './nowpayments-ipn-subscription'
import { handleOneTimeFinished, handleOneTimeRefunded } from './nowpayments-ipn-one-time'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { type Result } from '@/seed/types/result'
import type { D1Client } from '@/seed/db/d1-client-rpc'
import { getContractById } from '@/land/contracts/workflow/contract-converter'
import { fulfillNowPaymentsContractOrder } from '@/land/contracts/workflow/nowpayments-contract-fulfillment'
import { refundNowPaymentsContractOrder } from '@/land/contracts/workflow/nowpayments-contract-refund'
import { checkCryptoPaidAmount } from './ipn-amount-check'

// ── dispatchFinished ──────────────────────────────────────────────────────────

/**
 * Route a `finished` IPN event to the correct handler.
 * - One-time SKU invoice → handleOneTimeFinished
 * - Subscription tier invoice → handleFinished (existing, unchanged)
 * - Unknown invoice → warn + no-op
 */
export async function dispatchFinished(ipn: NowPaymentsIpnPayload, db?: D1Client): Promise<boolean> {
  if (db && ipn.order_id) {
    const order = await db.prepare(`SELECT order_id, user_id, contract_id, invoice_id,
        amount_usd_cents, provider_payment_id
      FROM pending_orders WHERE order_id = ?1 AND purpose = 'contract'
        AND payment_method = 'nowpayments' AND status IN ('pending', 'expired', 'failed', 'completed')`)
      .bind(ipn.order_id).first<{
        order_id: string; user_id: string; contract_id: string; invoice_id: string;
        amount_usd_cents: number; provider_payment_id: string | null;
      }>();
    if (order) {
      const eventId = `nowpayments_${ipn.payment_id}_finished`;
      const lock = await db.prepare('SELECT created_at FROM payment_events WHERE event_id = ?1 AND processed = 0')
        .bind(eventId).first<{ created_at: string }>();
      const contract = await getContractById(db.unwrap(), order.contract_id);
      const invoice = await db.prepare(`SELECT total_amount_cents, currency FROM invoices
        WHERE id = ?1 AND org_id = ?2`).bind(order.invoice_id, contract?.orgId ?? '').first<{
          total_amount_cents: number; currency: string;
        }>();
      const amount = checkCryptoPaidAmount(ipn.actually_paid, ipn.pay_amount, 0.99);
      if (!lock || !contract || !invoice || !ipn.invoice_id ||
          (order.provider_payment_id && order.provider_payment_id !== ipn.invoice_id) ||
          contract.lastInvoiceId !== order.invoice_id || invoice.currency !== 'USD' ||
          invoice.total_amount_cents !== order.amount_usd_cents ||
          ipn.price_currency.toUpperCase() !== 'USD' ||
          Math.round(ipn.price_amount * 100) !== invoice.total_amount_cents ||
          amount.status !== 'sufficient') {
        throw new Error('NOWPayments contract payment did not match its persisted invoice and payment amount');
      }
      await fulfillNowPaymentsContractOrder(db.unwrap(), {
        contract, invoiceId: order.invoice_id, orderId: order.order_id,
        paidByUserId: order.user_id, paymentId: ipn.payment_id,
        providerInvoiceId: ipn.invoice_id, amountCents: invoice.total_amount_cents,
        lockCreatedAt: lock.created_at,
      });
      return false;
    }
  }
  if (db && ipn.order_id) {
    // A contract order must never fall through to subscription tier fulfillment,
    // even if a stale/terminal state prevented its guarded settlement above.
    const contractOrder = await db.prepare(`SELECT order_id FROM pending_orders
      WHERE order_id = ?1 AND purpose = 'contract' AND payment_method = 'nowpayments'`)
      .bind(ipn.order_id).first<{ order_id: string }>();
    if (contractOrder) throw new Error('NOWPayments contract order could not be safely fulfilled');
  }
  const invoiceId = ipn.invoice_id
  if (!invoiceId) {
    logger.warn('[IPNDispatch] finished: missing invoice_id — falling through to subscription handler', {
      paymentId: ipn.payment_id,
    })
    await throwOnError(handleFinished(ipn))
    return true
  }

  const lookup = lookupInvoice(invoiceId)

  if (!lookup) {
    if (ipn.order_id) {
      logger.info('[IPNDispatch] Dynamic invoice with order_id — routing to subscription handler', {
        invoiceId,
        orderId: ipn.order_id,
        paymentId: ipn.payment_id,
      })
      await throwOnError(handleFinished(ipn))
      return true
    }
    logger.warn('[IPNDispatch] finished: unknown invoice_id and no order_id', { invoiceId, paymentId: ipn.payment_id })
    return true
  }

  if (lookup.kind === 'one_time') {
    logger.info('[IPNDispatch] Routing to one-time handler', { invoiceId, skuId: lookup.sku.id })
    await throwOnError(handleOneTimeFinished(ipn, lookup.sku))
      return true
  }

  // Subscription path: atomic lock in processNowPaymentsIpn (INSERT ON CONFLICT
  // DO NOTHING on payment_events.event_id) provides event-level idempotency.
  // Cross-payment dedup (same user+tier within 24h) belongs at invoice creation
  // time, not in the IPN handler. The previous SELECT-based guard here ran
  // outside the atomic lock and introduced a TOCTOU race condition.
  logger.info('[IPNDispatch] Routing to subscription handler', { invoiceId, tier: lookup.tier })
  await throwOnError(handleFinished(ipn))
  return true
}

// ── dispatchRefunded ──────────────────────────────────────────────────────────

/**
 * Route a `refunded` IPN event to the correct handler.
 */
export async function dispatchRefunded(ipn: NowPaymentsIpnPayload, db?: D1Client): Promise<void> {
  let contractOrderId = ipn.order_id;
  if (db && !contractOrderId && (ipn.payment_id || ipn.invoice_id)) {
    const matches = await db.prepare(`SELECT order_id FROM pending_orders
      WHERE purpose = 'contract' AND payment_method = 'nowpayments'
        AND status IN ('pending', 'expired', 'failed', 'completed')
        AND ((?1 != '' AND payment_id = ?1) OR (?2 != '' AND provider_payment_id = ?2))
      LIMIT 2`).bind(ipn.payment_id ?? '', ipn.invoice_id ?? '').all<{ order_id: string }>();
    const orders = matches.results ?? [];
    if (orders.length > 1) {
      throw new Error('NOWPayments contract refund correlation is ambiguous; retry after reconciliation');
    }
    if (orders.length === 1) contractOrderId = orders[0].order_id;
  }

  if (db && contractOrderId && ipn.invoice_id) {
    const order = await db.prepare(`SELECT order_id, user_id, contract_id, invoice_id,
        amount_usd_cents, provider_payment_id, status, payment_id
      FROM pending_orders WHERE order_id = ?1 AND purpose = 'contract'
        AND payment_method = 'nowpayments' AND status IN ('pending', 'expired', 'failed', 'completed')`)
      .bind(contractOrderId).first<{
        order_id: string; user_id: string; contract_id: string; invoice_id: string;
        amount_usd_cents: number; provider_payment_id: string | null;
        status: 'pending' | 'expired' | 'failed' | 'completed'; payment_id: string | null;
      }>();
    if (order) {
      const eventId = `nowpayments_${ipn.payment_id}_refunded`;
      const lock = await db.prepare('SELECT created_at FROM payment_events WHERE event_id = ?1 AND processed = 0')
        .bind(eventId).first<{ created_at: string }>();
      const contract = await getContractById(db.unwrap(), order.contract_id);
      const invoice = await db.prepare(`SELECT total_amount_cents, currency, status FROM invoices
        WHERE id = ?1 AND org_id = ?2`).bind(order.invoice_id, contract?.orgId ?? '').first<{
          total_amount_cents: number; currency: string; status: string;
        }>();
      const grant = await db.prepare(`SELECT payment_reference FROM mcu_transactions
        WHERE payment_reference = ?1 AND user_id = ?2 AND delta = ?3`)
        .bind(ipn.payment_id, order.user_id, contract?.mcuCapacityMonthly ?? -1)
        .first<{ payment_reference: string }>();
      const wasCompleted = invoice?.status === 'paid' && Boolean(grant);
      if (!lock || !contract || !invoice || !ipn.invoice_id ||
          (order.provider_payment_id && order.provider_payment_id !== ipn.invoice_id) ||
          (order.payment_id && order.payment_id !== ipn.payment_id) ||
          invoice.currency !== 'USD' ||
          invoice.total_amount_cents !== order.amount_usd_cents ||
          ipn.price_currency.toUpperCase() !== 'USD' ||
          Math.round(ipn.price_amount * 100) !== invoice.total_amount_cents ||
          (invoice.status === 'paid' && !wasCompleted) ||
          (Boolean(grant) && !wasCompleted) ||
          (order.status === 'completed' && !wasCompleted)) {
        throw new Error('NOWPayments contract refund did not match its persisted invoice and payment');
      }
      await refundNowPaymentsContractOrder(db.unwrap(), {
        contract, invoiceId: order.invoice_id, orderId: order.order_id,
        paidByUserId: order.user_id, paymentId: ipn.payment_id,
        providerInvoiceId: ipn.invoice_id, amountCents: invoice.total_amount_cents,
        lockCreatedAt: lock.created_at, orderStatus: order.status,
        wasCompleted,
      });
      return;
    }
  }

  if (db && contractOrderId && !ipn.invoice_id) {
    throw new Error('NOWPayments contract refund is missing provider invoice ID; retry after reconciliation');
  }

  const invoiceId = ipn.invoice_id

  if (!invoiceId) {
    // No invoice_id on refund — fall through to subscription handler
    await throwOnError(handleRefunded(ipn))
    return
  }

  const lookup = lookupInvoice(invoiceId)

  if (!lookup) {
    logger.warn('[IPNDispatch] refunded: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
    // Still fall through — subscription handler is safe on unknown
    await throwOnError(handleRefunded(ipn))
    return
  }

  if (lookup.kind === 'one_time') {
    logger.info('[IPNDispatch] Routing refund to one-time handler', { invoiceId })
    await throwOnError(handleOneTimeRefunded(ipn))
    return
  }

  await throwOnError(handleRefunded(ipn))
}

/**
 * Unwrap a Result<void, E> promise or throw the error.
 * Bridges the Result pattern to the legacy throw-based error flow in handlers.ts.
 */
async function throwOnError<E>(promise: Promise<Result<void, E>>): Promise<void> {
  const result = await promise;
  if (!result.ok) throw result.error;
}
