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
import { handleAgencyIPN } from './agency-billing'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { type Result } from '@/seed/types/result'

// ── dispatchFinished ──────────────────────────────────────────────────────────

/**
 * Route a `finished` IPN event to the correct handler.
 * - One-time SKU invoice → handleOneTimeFinished
 * - Subscription tier invoice → handleFinished (existing, unchanged)
 * - Unknown invoice → warn + no-op
 */
export async function dispatchFinished(ipn: NowPaymentsIpnPayload): Promise<void> {
  // ── Agency branch (FIRST — agency invoices are NOT in lookupInvoice registry) ─
  // Agency orders use "ag_" prefix and are routed by order_id, not invoice_id.
  // Checking this first prevents the null-lookup early-return from swallowing agency IPNs.
  if (ipn.order_id?.startsWith('ag_')) {
    logger.info('[IPNDispatch] Routing to agency handler', { orderId: ipn.order_id })
    await throwOnError(handleAgencyIPN(ipn))
    return
  }

  const invoiceId = ipn.invoice_id
  if (!invoiceId) {
    logger.warn('[IPNDispatch] finished: missing invoice_id — falling through to subscription handler', {
      paymentId: ipn.payment_id,
    })
    await throwOnError(handleFinished(ipn))
    return
  }

  const lookup = lookupInvoice(invoiceId)

  if (!lookup) {
    logger.warn('[IPNDispatch] finished: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
    return
  }

  if (lookup.kind === 'one_time') {
    logger.info('[IPNDispatch] Routing to one-time handler', { invoiceId, skuId: lookup.sku.id })
    await throwOnError(handleOneTimeFinished(ipn, lookup.sku))
    return
  }

  // Subscription path: atomic lock in processNowPaymentsIpn (INSERT ON CONFLICT
  // DO NOTHING on payment_events.event_id) provides event-level idempotency.
  // Cross-payment dedup (same user+tier within 24h) belongs at invoice creation
  // time, not in the IPN handler. The previous SELECT-based guard here ran
  // outside the atomic lock and introduced a TOCTOU race condition.
  logger.info('[IPNDispatch] Routing to subscription handler', { invoiceId, tier: lookup.tier })
  await throwOnError(handleFinished(ipn))
}

// ── dispatchRefunded ──────────────────────────────────────────────────────────

/**
 * Route a `refunded` IPN event to the correct handler.
 */
export async function dispatchRefunded(ipn: NowPaymentsIpnPayload): Promise<void> {
  // Agency branch: refund on agency order → agency handler
  if (ipn.order_id?.startsWith('ag_')) {
    logger.info('[IPNDispatch] Routing agency refund', { orderId: ipn.order_id })
    await throwOnError(handleAgencyIPN(ipn))
    return
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
