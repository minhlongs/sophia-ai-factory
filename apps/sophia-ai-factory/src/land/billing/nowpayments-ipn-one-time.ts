/**
 * NOWPayments IPN handler for One-Time bundle purchases.
 * Handles finished and refunded states for non-recurring SKUs.
 * Zero regression on subscription path — this file only handles one_time kind.
 *
 * P0.4: Underpayment guard added to handleOneTimeFinished.
 * If actually_paid < price_amount * 0.99, status is set to 'underpaid' and
 * fulfillment is NOT triggered. See nowpayments-ipn-underpaid.ts for the handler.
 *
 * @module billing/nowpayments-ipn-one-time
 */

import { logger } from '@/seed/utils/logger-utility'
import { getD1 } from '@/seed/db/client'
import { recordAudit } from '@/seed/db/audit/audit-log'
import { insertPurchase, markPaid, markRefunded, getByPaymentId, markOrderCompleted } from '@/seed/db/repositories/user-purchases-repo'
import { revokeAccessByPurchaseId } from '@/seed/db/repositories/videos-repo'
import { triggerOneTimeFulfillment } from '@/land/fulfillment/one-time-fulfillment'
import { markUnderpaid, UNDERPAYMENT_THRESHOLD } from './nowpayments-ipn-underpaid'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { parseUserIdFromOrderId, getDb } from './nowpayments-ipn-db'
import type { OneTimeSku } from '@/seed/types'
import { triggerAutoHandover } from '@/tree/handover/auto-handover'

// TTL helpers ────────────────────────────────────────────────────────────────

function addMonths(base: Date, months: number): Date {
  const d = new Date(base)
  const originalDay = d.getDate()
  d.setMonth(d.getMonth() + months)
  // Clamp to last day of target month to prevent overflow (e.g. Jan 31 + 1 month)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(originalDay, lastDay))
  return d
}

// ── finished ─────────────────────────────────────────────────────────────────

/**
 * Handle one-time IPN `finished` event.
 * Inserts user_purchases row (idempotent), marks paid, triggers fulfillment.
 * Rejects underpayments — sets status='underpaid', skips fulfillment.
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

  // P0.4: Underpayment guard — reject if actually_paid < price_amount * 0.99
  const actuallyPaid = ipn.actually_paid
  if (actuallyPaid !== undefined && actuallyPaid !== null) {
    const required = ipn.price_amount * UNDERPAYMENT_THRESHOLD
    if (actuallyPaid < required) {
      logger.warn('[IPN/OneTime] Underpayment detected — not fulfilling', {
        userId,
        paymentId: ipn.payment_id,
        priceAmount: ipn.price_amount,
        actuallyPaid,
        required,
      })
      await markUnderpaid(ipn.payment_id, userId, sku, actuallyPaid)
      return
    }
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

  // Update pending_orders to completed (FIX: was never updated for one-time)
  try {
  const _d1b = getD1()
  if (_d1b) {
  await _d1b.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?').bind('completed', ipn.payment_id, Math.floor(Date.now() / 1000), ipn.order_id)
  }
  } catch { /* non-fatal */ }

  // Audit trail
  try {
    const _d1 = getD1();
    if (!_d1) throw new Error('D1 database binding not available');
    const d1 = _d1;
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
  } catch (auditErr) {
    logger.error('[IPN/OneTime] Audit record failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined, {
      userId,
      purchaseId,
    })
  }

  logger.info('[IPN/OneTime] Purchase paid', {
    userId,
    purchaseId,
    skuId: sku.id,
    credits: sku.credits,
    paymentId: ipn.payment_id,
  })

  // Auto-handover for one-time bundle buyers — non-fatal
  try {
    const db = getDb()
  const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ipn.customer_email ?? ''
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? undefined
    if (userEmail) {
      await triggerAutoHandover({
        paymentId: ipn.payment_id,
        userId,
        email: userEmail,
        fullName: userName,
        tier: 'BASIC', // one-time bundle maps to BASIC starter pack (3 SOPs)
        isFirstPurchase: true,
      })
    }
  } catch (err) {
    logger.warn('[IPN/OneTime] Auto-handover failed (non-fatal)', { userId, error: String(err) })
  }

  // Trigger fulfillment (video gen + email) — non-fatal
  try {
    await triggerOneTimeFulfillment(userId, purchaseId, sku)
  } catch (err) {
    logger.error('[IPN/OneTime] Fulfillment trigger failed (non-fatal)', err instanceof Error ? err : undefined, {
      userId,
      purchaseId,
    })
  }
}

// ── refunded ─────────────────────────────────────────────────────────────────

/**
 * Handle one-time IPN `refunded` event.
 * Marks row refunded, zeros credits, and revokes access to all linked videos.
 * Default policy: revoke video access regardless of render state (F10).
 */
export async function handleOneTimeRefunded(
  ipn: NowPaymentsIpnPayload,
): Promise<void> {
  const userId = parseUserIdFromOrderId(ipn.order_id ?? '')
  if (!userId) {
    logger.warn('[IPN/OneTime] refunded: cannot parse userId', { orderId: ipn.order_id })
    return
  }

  // Look up purchase id by payment_id before zeroing credits
  const existingPurchase = await getByPaymentId(ipn.payment_id)
  const purchaseId = existingPurchase?.id ?? null

  await markRefunded(ipn.payment_id)

  // F10: Revoke video access for ALL videos linked to this purchase
  if (purchaseId) {
    try {
      await revokeAccessByPurchaseId(purchaseId)
      logger.info('[IPN/OneTime] Video access revoked for refunded purchase', {
        userId,
        purchaseId,
        paymentId: ipn.payment_id,
      })
    } catch (revokeErr) {
      logger.error('[IPN/OneTime] Video access revocation failed (non-fatal)', revokeErr instanceof Error ? revokeErr : undefined, {
        userId,
        purchaseId,
        paymentId: ipn.payment_id,
      })
    }
  }

  // Audit trail
  try {
    const _d1 = getD1();
    if (!_d1) throw new Error('D1 database binding not available');
    const d1 = _d1;
    await recordAudit(d1, {
      tableName: 'user_purchases',
      rowId: ipn.payment_id,
      action: 'update',
      actorId: userId,
      after: { status: 'refunded', credits_remaining: 0, paymentId: ipn.payment_id, accessRevoked: true },
    })
  } catch (auditErr) {
    logger.error('[IPN/OneTime] Refund audit failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined, {
      userId,
      purchaseId,
      paymentId: ipn.payment_id,
    })
  }

  // Revert tier from auto-handover: one-time refund → downgrade to BASIC
  // The user's tier was set by the one-time purchase (e.g. FREE100 → MASTER).
  // A full refund should undo that upgrade.
  try {
    const _d1 = getD1();
    if (!_d1) throw new Error('D1 database binding not available');
    const d1 = _d1;
  const nowSec = Math.floor(Date.now() / 1000)
    // Update subscriptions table
 const subResult = await d1.prepare('UPDATE subscriptions SET plan = ?, updated_at = ? WHERE user_id = ? AND plan != ?')
   .bind('basic', nowSec, userId, 'basic')
   .run()
 const orgRow = await d1.prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
   .bind(userId)
   .first<{ org_id: string }>()
 if (orgRow?.org_id) {
   await d1.prepare('UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ? AND plan != ?')
     .bind('basic', nowSec, orgRow.org_id, 'basic')
     .run()
 }
 logger.info('[IPN/OneTime] Tier reverted to basic after refund', {
  userId,
  purchaseId,
  paymentId: ipn.payment_id,
  subscriptionRowsAffected: subResult.meta?.changes ?? 0,
 })
  } catch (tierErr) {
    logger.error('[IPN/OneTime] Tier revert failed (non-fatal)', tierErr instanceof Error ? tierErr : undefined, {
      userId,
      purchaseId,
      paymentId: ipn.payment_id,
    })
  }

  logger.info('[IPN/OneTime] Purchase refunded — credits zeroed, access revoked', {
    userId,
    purchaseId,
    paymentId: ipn.payment_id,
  })
}
