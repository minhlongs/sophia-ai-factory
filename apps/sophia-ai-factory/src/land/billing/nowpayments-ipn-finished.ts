/**
 * NOWPayments IPN handler for successful subscription payments.
 * Validates IPN, activates subscription, then delegates post-purchase workflows.
 * @module billing/nowpayments-ipn-finished
 */

import { getTierByInvoiceId, NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client'
import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { getD1 } from '@/seed/db/client'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { getOrderById } from '@/land/orders/pending-order-repo'
import { UNDERPAYMENT_THRESHOLD } from './nowpayments-ipn-underpaid'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'
import { calculatePeriodEnd } from './nowpayments-ipn-utils'
import { runPostActivationWorkflow } from './nowpayments-post-purchase'
import { activateSubscriptionForOrg } from './nowpayments-subscription-activate'

const AMOUNT_MISMATCH_THRESHOLD = 0.01

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

async function validateIpnAndGetUserId(ipn: NowPaymentsIpnPayload): Promise<string | null> {
  const actuallyPaid = ipn.actually_paid
  if (actuallyPaid !== undefined && actuallyPaid !== null) {
    const required = ipn.price_amount * UNDERPAYMENT_THRESHOLD
    if (actuallyPaid < required) {
      logger.warn('[NOWPayments] Subscription underpayment — not activating', {
        paymentId: ipn.payment_id, priceAmount: ipn.price_amount, actuallyPaid, required,
      })
      return null
    }
  }

  if (actuallyPaid !== undefined && actuallyPaid !== null && actuallyPaid > ipn.price_amount) {
    const db = getDb()
    try {
      await db.from('audit_log').insert({
        action_type: 'overpayment_detected',
        target_user_id: ipn.order_id ?? '',
        payload: JSON.stringify({
          payment_id: ipn.payment_id,
          expected: ipn.price_amount,
          actual: actuallyPaid,
          overage: actuallyPaid - ipn.price_amount,
        }),
        created_at: new Date().toISOString(),
      })
    } catch (auditErr) {
      logger.warn('[NOWPayments] Overpayment audit insert failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined)
    }
  }

  const invoiceId = ipn.invoice_id
  if (!invoiceId && !ipn.order_id) {
    logger.warn('[NOWPayments] finished: missing invoice_id and order_id', { paymentId: ipn.payment_id })
    return null
  }
  // Primary: resolve tier from pre-created invoice IDs (static config)
  const tierConfig = invoiceId ? getTierByInvoiceId(invoiceId) : null
  if (!tierConfig) {
    // Fallback: SDK-created checkouts don't use static invoice IDs — resolve via order_id → pending_orders
    if (ipn.order_id) {
      const pendingOrder = await getOrderById(ipn.order_id).catch(() => null)
      if (!pendingOrder) {
        logger.warn('[NOWPayments] finished: unknown invoice_id and no pending_order match', { invoiceId, orderId: ipn.order_id, paymentId: ipn.payment_id })
        return null
      }
      return parseUserIdFromOrderId(ipn.order_id) || null
    }
    logger.warn('[NOWPayments] finished: unknown invoice_id, no order_id', { invoiceId, paymentId: ipn.payment_id })
    return null
  }
  return parseUserIdFromOrderId(ipn.order_id || '') || null
}

async function setupDatabaseAndContext(
  ipn: NowPaymentsIpnPayload,
  userId: string
): Promise<{
  d1: D1Database
  db: ReturnType<typeof getDb>
  tier: Tier
  billingPeriod: 'monthly' | 'yearly' | 'lifetime'
  periodEnd: string
  now: string
  orgId: string | undefined
} | null> {
  const db = getDb()
  const _d1 = await getD1()
  if (!_d1) throw new Error('D1 database binding not available')
  const d1 = _d1!

  const tierConfig = ipn.invoice_id ? getTierByInvoiceId(ipn.invoice_id) : null
  let tier: Tier
  if (tierConfig) {
    tier = tierConfig.tier
  } else {
    // Fallback: SDK-created checkouts — resolve tier from pending_orders
    const pendingOrder = ipn.order_id ? await getOrderById(ipn.order_id).catch(() => null) : null
    if (!pendingOrder?.tier) return null
    tier = pendingOrder.tier as Tier
  }
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const billingPeriod = await resolveBillingPeriod(ipn, isLifetime)

  const expectedPrice = billingPeriod === 'yearly'
    ? (UNIFIED_TIERS[tier]?.yearlyPrice ?? NOWPAYMENTS_TIERS[tier]?.yearlyPrice)
    : NOWPAYMENTS_TIERS[tier]?.price
  if (expectedPrice !== undefined && ipn.price_amount !== undefined) {
    const deviation = Math.abs(ipn.price_amount - expectedPrice)
    if (deviation > expectedPrice * AMOUNT_MISMATCH_THRESHOLD) {
      logger.warn('[NOWPayments] Amount mismatch — rejecting subscription activation', {
        paymentId: ipn.payment_id, tier, expectedPrice, receivedAmount: ipn.price_amount, deviation,
      })
      return null
    }
  }

  const periodEnd = calculatePeriodEnd(billingPeriod)
  const now = new Date().toISOString()
  const orgId = await findOrgIdForUser(userId, db)
  return { d1, db, tier, billingPeriod, periodEnd, now, orgId }
}

async function resolveBillingPeriod(ipn: NowPaymentsIpnPayload, isLifetime: boolean): Promise<'monthly' | 'yearly' | 'lifetime'> {
  if (isLifetime) return 'lifetime'
  let billingPeriod: 'monthly' | 'yearly' | 'lifetime' = 'monthly'
  if (ipn.order_id) {
    try {
      const pendingOrder = await getOrderById(ipn.order_id)
      if (pendingOrder?.period === 'yearly') billingPeriod = 'yearly'
      else if (pendingOrder?.period === 'lifetime') billingPeriod = 'lifetime'
    } catch (e) { safeCatch('Billing period lookup')(e) }
  }
  return billingPeriod
}

async function findOrgIdForUser(userId: string, db: ReturnType<typeof getDb>): Promise<string | undefined> {
  const { data: membership } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  return (membership as { org_id?: string } | null)?.org_id
}
