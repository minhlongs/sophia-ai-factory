/**
 * NOWPayments IPN agency dispatcher — handles agency tier payment events.
 *
 * Only processes payment_status events for agency-tier invoices:
 *   "agency_tier_starter", "agency_tier_growth", "agency_tier_enterprise"
 *
 * Co-located with the main IPN dispatcher to keep routing logic together.
 * The main dispatcher (nowpayments-ipn-dispatch.ts) delegates here for
 * agency-order IPNs (order_id starting with "ag_").
 *
 * @module billing/nowpayments-ipn-dispatch-agency
 */

import { logger } from '@/seed/utils/logger-utility'
import { type NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getD1 } from '@/seed/db/client'
import { handleAgencyIPN } from './agency-billing'
import { type Result } from '@/seed/types/result'
import { lookupAgencyInvoice } from '@/tree/clients/nowpayments-client'


// ── Agency tier invoice IDs (NOWPayments pre-created invoices) ─────────────

const AGENCY_INVOICE_IDS: ReadonlySet<string> = new Set([
  // agency_tier_starter → $500/mo (invoice to be created in NOWPayments dashboard)
  // agency_tier_growth  → $1500/mo
  // agency_tier_enterprise → $3000/mo
  // These are placeholder IDs until NOWPayments dashboard invoices are created.
  // The primary routing is by order_id prefix "ag_", not invoice_id.
])

/** Known agency tier payment statuses */
const AGENCY_TIER_STATUSES = new Set([
  'agency_tier_starter',
  'agency_tier_growth',
  'agency_tier_enterprise',
])

// ── Finished ─────────────────────────────────────────────────────────────

/**
 * Route a `finished` IPN event to the agency handler.
 * Only processes for agency tier payments; logs and skips for others.
 */
export async function dispatchAgencyFinished(
  ipn: NowPaymentsIpnPayload,
): Promise<void> {
  if (!isAgencyTierPayment(ipn)) {
    logger.debug('[IPNDispatch/Agency] Non-agency payment — skipping agency handler', {
      paymentId: ipn.payment_id,
      invoiceId: ipn.invoice_id,
      orderId: ipn.order_id,
    })
    return
  }
  await processAgencyIpn(ipn)
}

// ── Refunded ─────────────────────────────────────────────────────────────

/**
 * Route a `refunded` IPN event to the agency handler.
 * Agency refunds: deactivate agency or downgrade to starter.
 */
export async function dispatchAgencyRefunded(
  ipn: NowPaymentsIpnPayload,
): Promise<void> {
  if (!isAgencyTierPayment(ipn)) {
    logger.debug('[IPNDispatch/Agency] Non-agency refund — skipping agency handler', {
      paymentId: ipn.payment_id,
      invoiceId: ipn.invoice_id,
      orderId: ipn.order_id,
    })
    return
  }
  await processRefundedAgency(ipn)
}

// ── Private helpers ───────────────────────────────────────────────────────

function isAgencyTierPayment(ipn: NowPaymentsIpnPayload): boolean {
  // Primary signal: order_id starts with agency prefix
  if (ipn.order_id?.startsWith('ag_')) return true

  // Fallback: order_description contains agency tier marker
  if (ipn.order_description?.startsWith('agency_tier_')) return true

  // Option C fallback: invoice_id registered in agency invoice config
  if (ipn.invoice_id && lookupAgencyInvoice(ipn.invoice_id)) return true

  return false
}

async function processAgencyIpn(ipn: NowPaymentsIpnPayload): Promise<void> {
  // Atomic lock: INSERT ON CONFLICT DO NOTHING on payment_events
  // (the caller processNowPaymentsIpn already holds this lock at the event level,
  //  but we add agency-specific event_id for cross-reference)
  const eventId = `nowpayments_${ipn.payment_id}_${ipn.payment_status}`

  // Delegate to agency billing handler (Result pattern → throw for legacy flow)
  await throwOnError(handleAgencyIPN(ipn))

  logger.info('[IPNDispatch/Agency] Agency IPN processed', {
    eventId,
    paymentId: ipn.payment_id,
    orderId: ipn.order_id,
    invoiceId: ipn.invoice_id,
  })
}

async function processRefundedAgency(ipn: NowPaymentsIpnPayload): Promise<void> {
  const eventId = `nowpayments_${ipn.payment_id}_${ipn.payment_status}`

  try {
    const { parseAgencyIdFromOrderId } = await import('./nowpayments-ipn-db')
    const agencyId = parseAgencyIdFromOrderId(ipn.order_id ?? '')

    if (!agencyId) {
      logger.warn('[IPNDispatch/Agency] Refund: cannot parse agency ID', {
        orderId: ipn.order_id,
        paymentId: ipn.payment_id,
      })
      return
    }

    // Downgrade agency to starter tier on refund
    const d1 = getD1()
    if (!d1) {
  logger.error('[IPNDispatch/Agency] D1 unavailable', { agencyId })
  return
}
const now = Math.floor(Date.now() / 1000)
    await d1
  .prepare('UPDATE agency SET tier = ?, updated_at = ? WHERE id = ?')
  .bind('starter', now, Number.parseInt(agencyId, 10))
  .run()

    logger.info('[IPNDispatch/Agency] Agency downgraded to starter after refund', {
      agencyId,
      eventId,
      paymentId: ipn.payment_id,
    })
  } catch (err) {
    logger.error('[IPNDispatch/Agency] Refund processing failed', {
      eventId,
      paymentId: ipn.payment_id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function throwOnError<E>(
  promise: Promise<Result<void, E>>,
): Promise<void> {
  const result = await promise
  if (!result.ok) throw result.error
}
