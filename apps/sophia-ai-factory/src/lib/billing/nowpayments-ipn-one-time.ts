/**
 * NOWPayments IPN handler for One-Time bundle purchases.
 * Handles finished and refunded states for non-recurring SKUs.
 * Zero regression on subscription path — this file only handles one_time kind.
 *
 * @module billing/nowpayments-ipn-one-time
 */

import { logger } from '@/lib/utils/logger-utility'
import { getD1Raw } from '@/lib/db/client'
import { recordAudit } from '@/lib/db/audit/audit-log'
import { insertPurchase, markPaid, markRefunded } from '@/lib/db/repositories/user-purchases-repo'
import { triggerOneTimeFulfillment } from '@/lib/fulfillment/one-time-fulfillment'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { parseUserIdFromOrderId } from './nowpayments-ipn-db'
import type { OneTimeSku } from '@/types'

// TTL helpers ────────────────────────────────────────────────────────────────

function addMonths(base: Date, months: number): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + months)
  return d
}

// ── finished ─────────────────────────────────────────────────────────────────

/**
 * Handle one-time IPN `finished` event.
 * Inserts user_purchases row (idempotent), marks paid, triggers fulfillment.
 */
export async function handleOneTimeFinished(
  ipn: NowPaymentsIpnPayload,
  sku: OneTimeSku,
): Promise<void> {
  const userId = parseUserIdFromOrderId(ipn.order_id ?? '')
  if (!userId) {
    logger.warn('[IPN/OneTime] finished: cannot parse userId', { orderId: ipn.order_id, paymentId: ipn.payment_id })
    return
  }

  const expiresAt = Math.floor(addMonths(new Date(), sku.ttlMonths).getTime() / 1000)
  const amountCents = Math.round(ipn.price_amount * 100)

  // Insert purchase row (idempotent — returns existing id if conflict)
  const purchaseId = await insertPurchase({
    userId,
    kind: 'one_time',
    sku: sku.id,
    paymentId: ipn.payment_id,
    invoiceId: ipn.invoice_id ?? null,
    amountCents,
    creditsTotal: sku.credits,
    expiresAt,
    status: 'pending',
  })

  if (!purchaseId) {
    logger.error('[IPN/OneTime] finished: failed to insert purchase row', undefined, {
      paymentId: ipn.payment_id,
      userId,
    })
    return
  }

  // Mark paid + set credits_remaining
  await markPaid(ipn.payment_id, sku.credits, expiresAt)

  // Audit trail
  try {
    const d1 = await getD1Raw()
    await recordAudit(d1, {
      tableName: 'user_purchases',
      rowId: purchaseId,
      action: 'update',
      actorId: userId,
      after: {
        status: 'paid',
        sku: sku.id,
        credits: sku.credits,
        expiresAt,
        paymentId: ipn.payment_id,
      },
    })
  } catch { /* non-fatal */ }

  logger.info('[IPN/OneTime] Purchase paid', {
    userId,
    purchaseId,
    skuId: sku.id,
    credits: sku.credits,
    paymentId: ipn.payment_id,
  })

  // Trigger fulfillment (video gen + email) — non-fatal
  try {
    await triggerOneTimeFulfillment(userId, purchaseId, sku)
  } catch (err) {
    logger.warn('[IPN/OneTime] Fulfillment trigger failed (non-fatal)', {
      userId,
      purchaseId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ── refunded ─────────────────────────────────────────────────────────────────

/**
 * Handle one-time IPN `refunded` event.
 * Marks row refunded + zeros credits. Video access NOT revoked (CEO decision).
 */
export async function handleOneTimeRefunded(
  ipn: NowPaymentsIpnPayload,
): Promise<void> {
  const userId = parseUserIdFromOrderId(ipn.order_id ?? '')
  if (!userId) {
    logger.warn('[IPN/OneTime] refunded: cannot parse userId', { orderId: ipn.order_id })
    return
  }

  await markRefunded(ipn.payment_id)

  // Audit trail
  try {
    const d1 = await getD1Raw()
    await recordAudit(d1, {
      tableName: 'user_purchases',
      rowId: ipn.payment_id,
      action: 'update',
      actorId: userId,
      after: { status: 'refunded', credits_remaining: 0, paymentId: ipn.payment_id },
    })
  } catch { /* non-fatal */ }

  logger.info('[IPN/OneTime] Purchase refunded — credits zeroed', {
    userId,
    paymentId: ipn.payment_id,
  })
}
