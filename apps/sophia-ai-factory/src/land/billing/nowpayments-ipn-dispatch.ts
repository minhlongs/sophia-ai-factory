/**
 * IPN dispatcher — routes `finished` and `refunded` events to the correct handler
 * (contract, subscription OR one_time) based on order and invoice_id lookup.
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
import { assertContractFinishedIsSafe, dispatchContractFinished } from './ipn-contract-finished'
import { assertContractRefundIsCorrelatable, dispatchContractRefunded, resolveContractOrderId } from './ipn-contract-refunded'

// ── dispatchFinished ──────────────────────────────────────────────────────────

/**
 * Route a `finished` IPN event to the correct handler.
 * - Enterprise contract order → contract fulfillment
 * - One-time SKU invoice → handleOneTimeFinished
 * - Subscription tier invoice → handleFinished (existing, unchanged)
 * - Unknown invoice → warn + no-op
 */
export async function dispatchFinished(ipn: NowPaymentsIpnPayload, db?: D1Client): Promise<boolean> {
  if (db) {
    const contractOutcome = await dispatchContractFinished(ipn, db)
    if (contractOutcome !== null) return contractOutcome
    // A contract order must never fall through to subscription tier fulfillment,
    // even if a stale/terminal state prevented its guarded settlement above.
    if (ipn.order_id) await assertContractFinishedIsSafe(db, ipn.order_id)
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
  let contractOrderId = ipn.order_id

  if (db) {
    contractOrderId = await resolveContractOrderId(ipn, db)

    const contractOutcome = await dispatchContractRefunded(ipn, db, contractOrderId)
    if (contractOutcome !== null) return

    if (contractOrderId && !ipn.invoice_id) {
      throw new Error('NOWPayments contract refund is missing provider invoice ID; retry after reconciliation');
    }
    await assertContractRefundIsCorrelatable({ ...ipn, order_id: ipn.order_id }, db)
  }

  const invoiceId = ipn.invoice_id

  if (!invoiceId) {
    if (!ipn.order_id) {
      throw new Error('NOWPayments refund is missing invoice and order correlation; retry after reconciliation');
    }
    // No invoice_id on refund — fall through to subscription handler
    await throwOnError(handleRefunded(ipn))
    return
  }

  const lookup = lookupInvoice(invoiceId)

  if (!lookup) {
    logger.warn('[IPNDispatch] refunded: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
    if (!ipn.order_id && !contractOrderId) {
      throw new Error('NOWPayments refund has no persisted order correlation; retry after reconciliation');
    }
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
