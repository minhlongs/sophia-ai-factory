/**
 * NOWPayments IPN handler for successful subscription payments.
 * Validates IPN, activates subscription, then delegates post-purchase workflows.
 * @module billing/nowpayments-ipn-finished
 */

import { getTierByInvoiceId } from '@/tree/clients/nowpayments-client'
import { logger } from '@/seed/utils/logger-utility'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { getOrderById } from '@/land/orders/pending-order-repo'
import { UNDERPAYMENT_THRESHOLD } from './nowpayments-ipn-underpaid'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'
import { runPostActivationWorkflow } from './nowpayments-post-purchase'
import { activateSubscriptionForOrg } from './nowpayments-subscription-activate'
import { setupDatabaseAndContext } from './nowpayments-ipn-finished-context'
import { checkCryptoPaidAmount } from './ipn-amount-check'

export async function handleFinished(ipn: NowPaymentsIpnPayload): Promise<Result<void, IPNError>> {
  try {
    const userId = await validateIpnAndGetUserId(ipn)
    if (!userId) return success(undefined)
    const ctx = await setupDatabaseAndContext(ipn, userId)
    if (!ctx) return success(undefined)
    const { d1, db, tier, billingPeriod, periodEnd, now, orgId } = ctx
    await activateSubscriptionForOrg(orgId, userId, tier, billingPeriod, periodEnd, now, ipn, d1, db)
    await runPostActivationWorkflow(userId, tier, billingPeriod, periodEnd, orgId, ipn, d1, db)
    logger.info('[NOWPayments] Payment finished — subscription activated', { userId, orgId, tier, isLifetime: billingPeriod === 'lifetime', periodEnd, paymentId: ipn.payment_id })
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('HANDLE_FINISHED_FAILED', err))
  }
}

async function safeGetPendingOrder(orderId: string | undefined) {
  if (!orderId) return null
  try {
    return await getOrderById(orderId)
  } catch {
    return null
  }
}

async function recordOverpaymentAuditIfNeeded(ipn: NowPaymentsIpnPayload): Promise<void> {
  const actuallyPaid = ipn.actually_paid
  if (actuallyPaid === undefined || actuallyPaid === null || ipn.pay_amount === undefined || actuallyPaid <= ipn.pay_amount) {
    return
  }
  const db = getDb()
  try {
    await db.from('audit_log').insert({
      action_type: 'overpayment_detected',
      target_user_id: ipn.order_id ?? '',
      payload: JSON.stringify({
        payment_id: ipn.payment_id,
        expected: ipn.pay_amount,
        actual: actuallyPaid,
        overage: actuallyPaid - ipn.pay_amount,
        currency: ipn.pay_currency ?? null,
      }),
      created_at: new Date().toISOString(),
    })
  } catch (auditErr) {
    logger.warn('[NOWPayments] Overpayment audit insert failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined)
  }
}

function resolveUserFromOrderAndConfig(
  ipn: NowPaymentsIpnPayload,
  tierConfig: ReturnType<typeof getTierByInvoiceId>,
  pendingOrder: Awaited<ReturnType<typeof getOrderById>>,
): string | null {
  const parsedUserId = parseUserIdFromOrderId(ipn.order_id || '')
  if (!tierConfig) {
    if (!pendingOrder) {
      logger.warn('[NOWPayments] finished: unknown invoice_id and no pending_order match', {
        invoiceId: ipn.invoice_id,
        orderId: ipn.order_id,
        paymentId: ipn.payment_id,
      })
      return null
    }
    if (parsedUserId && pendingOrder.user_id && parsedUserId !== pendingOrder.user_id) {
      logger.warn('[NOWPayments] finished: order_id user mismatch against pending_orders owner', {
        orderId: ipn.order_id,
        parsedUserId,
        orderUserId: pendingOrder.user_id,
        paymentId: ipn.payment_id,
      })
      return null
    }
    return pendingOrder.user_id || parsedUserId || null
  }
  if (!pendingOrder?.user_id) return parsedUserId || null
  if (parsedUserId && parsedUserId !== pendingOrder.user_id) {
    logger.warn('[NOWPayments] finished: static invoice order_id user mismatch against pending_orders owner', {
      orderId: ipn.order_id,
      parsedUserId,
      orderUserId: pendingOrder.user_id,
      paymentId: ipn.payment_id,
    })
    return null
  }
  if (pendingOrder.tier && pendingOrder.tier !== tierConfig.tier) {
    logger.warn('[NOWPayments] finished: static invoice tier mismatch against pending_orders tier', {
      orderId: ipn.order_id,
      invoiceTier: tierConfig.tier,
      orderTier: pendingOrder.tier,
      paymentId: ipn.payment_id,
    })
    return null
  }
  return pendingOrder.user_id
}

async function validateIpnAndGetUserId(ipn: NowPaymentsIpnPayload): Promise<string | null> {
  const actuallyPaid = ipn.actually_paid
  const amountCheck = checkCryptoPaidAmount(actuallyPaid, ipn.pay_amount, UNDERPAYMENT_THRESHOLD)
  if (amountCheck.status !== 'sufficient') {
    if (amountCheck.status === 'underpaid') {
      logger.warn('[NOWPayments] Subscription underpayment — not activating', {
        paymentId: ipn.payment_id,
        payAmount: ipn.pay_amount,
        payCurrency: ipn.pay_currency,
        actuallyPaid,
        required: amountCheck.required,
      })
    } else {
      logger.error('[NOWPayments] Paid amount cannot be verified without a sufficient crypto payment amount', {
        paymentId: ipn.payment_id,
        status: amountCheck.status,
        payAmount: ipn.pay_amount,
        actuallyPaid,
        payCurrency: ipn.pay_currency,
      })
    }
    return null
  }

  await recordOverpaymentAuditIfNeeded(ipn)

  const invoiceId = ipn.invoice_id
  if (!invoiceId && !ipn.order_id) {
    logger.warn('[NOWPayments] finished: missing invoice_id and order_id', { paymentId: ipn.payment_id })
    return null
  }
  const tierConfig = invoiceId ? getTierByInvoiceId(invoiceId) : null
  const pendingOrder = await safeGetPendingOrder(ipn.order_id)
  return resolveUserFromOrderAndConfig(ipn, tierConfig, pendingOrder)
}
