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
import { safeCatch } from '@/seed/utils/safe-catch'
import { lookupInvoice } from '@/tree/clients/nowpayments-client'
import { handleFinished, handleRefunded } from './nowpayments-ipn-subscription'
import { handleOneTimeFinished, handleOneTimeRefunded } from './nowpayments-ipn-one-time'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'

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

  // Default: subscription path — guard against double-pay before processing.
  // When dedupe at checkout silently fails, duplicate invoices can be created.
  // This check prevents activating/crediting twice for same (userId, tier) within 24h.
  const userId = parseUserIdFromOrderId(ipn.order_id ?? '')
  if (userId && lookup.tier) {
    try {
      const db = getDb()
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recent } = await db
        .from('pending_orders')
        .select('order_id, payment_id')
        .eq('user_id', userId)
        .eq('tier', lookup.tier)
        .eq('status', 'completed')
        .gte('completed_at', cutoff)
        .neq('order_id', ipn.order_id ?? '')
        .limit(1)
        .single()
      if (recent?.order_id) {
        logger.warn('[IPNDispatch] Duplicate payment detected for same user+tier within 24h — skipping', {
          userId,
          tier: lookup.tier,
          currentOrderId: ipn.order_id,
          existingOrderId: recent.order_id,
          existingPaymentId: recent.payment_id,
          paymentId: ipn.payment_id,
        })
        return
      }
    } catch (e) {
      // Non-fatal: if dedup check fails, proceed with processing (better to double-process
      // than to silently drop a legitimate payment)
      safeCatch('Dedup check')(e)
      logger.warn('[IPNDispatch] Dedup check failed (non-fatal) — proceeding with processing', {
        userId,
        tier: lookup.tier,
        paymentId: ipn.payment_id,
      })
    }
  }

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
