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

// ── dispatchFinished ──────────────────────────────────────────────────────────

/**
 * Route a `finished` IPN event to the correct handler.
 * - One-time SKU invoice → handleOneTimeFinished
 * - Subscription tier invoice → handleFinished (existing, unchanged)
 * - Unknown invoice → warn + no-op
 */
export async function dispatchFinished(ipn: NowPaymentsIpnPayload): Promise<void> {
  const invoiceId = ipn.invoice_id
  if (!invoiceId) {
    logger.warn('[IPNDispatch] finished: missing invoice_id — falling through to subscription handler', {
      paymentId: ipn.payment_id,
    })
    await handleFinished(ipn)
    return
  }

  const lookup = lookupInvoice(invoiceId)

  if (!lookup) {
    logger.warn('[IPNDispatch] finished: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
    return
  }

  if (lookup.kind === 'one_time') {
    logger.info('[IPNDispatch] Routing to one-time handler', { invoiceId, skuId: lookup.sku.id })
    await handleOneTimeFinished(ipn, lookup.sku)
    return
  }

  // Default: subscription path (existing handler — zero change)
  logger.info('[IPNDispatch] Routing to subscription handler', { invoiceId, tier: lookup.tier })
  await handleFinished(ipn)
}

// ── dispatchRefunded ──────────────────────────────────────────────────────────

/**
 * Route a `refunded` IPN event to the correct handler.
 */
export async function dispatchRefunded(ipn: NowPaymentsIpnPayload): Promise<void> {
  const invoiceId = ipn.invoice_id

  if (!invoiceId) {
    // No invoice_id on refund — fall through to subscription handler
    await handleRefunded(ipn)
    return
  }

  const lookup = lookupInvoice(invoiceId)

  if (!lookup) {
    logger.warn('[IPNDispatch] refunded: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
    // Still fall through — subscription handler is safe on unknown
    await handleRefunded(ipn)
    return
  }

  if (lookup.kind === 'one_time') {
    logger.info('[IPNDispatch] Routing refund to one-time handler', { invoiceId })
    await handleOneTimeRefunded(ipn)
    return
  }

  await handleRefunded(ipn)
}
