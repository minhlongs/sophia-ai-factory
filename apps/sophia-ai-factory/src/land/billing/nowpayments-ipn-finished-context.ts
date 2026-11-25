/**
 * NOWPayments IPN Finished — Database & Subscription Context Setup.
 *
 * @module billing/nowpayments-ipn-finished-context
 */

import { getTierByInvoiceId, NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client'
import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { getD1 } from '@/seed/db/client'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'
import { getOrderById } from '@/land/orders/pending-order-repo'
import { calculatePeriodEnd } from './nowpayments-ipn-utils'
import { resolveOrgId } from '@/seed/auth/workspace-access'

const AMOUNT_MISMATCH_THRESHOLD = 0.01

export interface FinishedActivationContext {
  d1: D1Database
  db: ReturnType<typeof getDb>
  tier: Tier
  billingPeriod: 'monthly' | 'yearly' | 'lifetime'
  periodEnd: string
  now: string
  orgId: string | undefined
}

async function safeLoadOrder(orderId: string | undefined) {
  if (!orderId) return null
  try {
    return await getOrderById(orderId)
  } catch {
    return null
  }
}

function resolveValidatedTier(
  ipn: NowPaymentsIpnPayload,
  userId: string,
  pendingOrder: Awaited<ReturnType<typeof getOrderById>>,
): Tier | null {
  if (pendingOrder?.user_id && pendingOrder.user_id !== userId) {
    logger.warn('[NOWPayments] Resolved userId mismatch against authoritative pending_orders.user_id', {
      paymentId: ipn.payment_id,
      orderId: ipn.order_id,
      resolvedUserId: userId,
      orderUserId: pendingOrder.user_id,
    })
    return null
  }
  const tierConfig = ipn.invoice_id ? getTierByInvoiceId(ipn.invoice_id) : null
  if (tierConfig) {
    if (pendingOrder?.tier && pendingOrder.tier !== tierConfig.tier) {
      logger.warn('[NOWPayments] Static invoice tier mismatch against pending_orders', {
        paymentId: ipn.payment_id,
        orderId: ipn.order_id,
        invoiceTier: tierConfig.tier,
        orderTier: pendingOrder.tier,
      })
      return null
    }
    return tierConfig.tier
  }
  return pendingOrder?.tier ? (pendingOrder.tier as Tier) : null
}

function verifyUsdPriceMatch(
  ipn: NowPaymentsIpnPayload,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  pendingOrder: Awaited<ReturnType<typeof getOrderById>>,
): boolean {
  const authoritativeOrderUsd =
    pendingOrder?.amount_usd_cents && pendingOrder.amount_usd_cents > 0
      ? pendingOrder.amount_usd_cents / 100
      : undefined
  const expectedPrice = authoritativeOrderUsd ?? (billingPeriod === 'yearly'
    ? (UNIFIED_TIERS[tier]?.yearlyPrice ?? NOWPAYMENTS_TIERS[tier]?.yearlyPrice)
    : NOWPAYMENTS_TIERS[tier]?.price)
  if (expectedPrice === undefined || ipn.price_amount === undefined) return true
  const receivedCurrency = ipn.price_currency?.trim().toLowerCase()
  if (receivedCurrency !== 'usd') {
    logger.warn('[NOWPayments] Non-USD or missing price currency — rejecting subscription activation', {
      paymentId: ipn.payment_id, tier, expectedCurrency: 'usd', receivedCurrency: ipn.price_currency ?? null,
    })
    return false
  }
  const deviation = Math.abs(ipn.price_amount - expectedPrice)
  if (deviation > expectedPrice * AMOUNT_MISMATCH_THRESHOLD) {
    logger.warn('[NOWPayments] Amount mismatch — rejecting subscription activation', {
      paymentId: ipn.payment_id, tier, expectedPrice, receivedAmount: ipn.price_amount, deviation,
    })
    return false
  }
  return true
}

export async function setupDatabaseAndContext(
  ipn: NowPaymentsIpnPayload,
  userId: string
): Promise<FinishedActivationContext | null> {
  const db = getDb()
  const _d1 = await getD1()
  if (!_d1) throw new Error('D1 database binding not available')
  const d1 = _d1!

  const pendingOrder = await safeLoadOrder(ipn.order_id)
  const tier = resolveValidatedTier(ipn, userId, pendingOrder)
  if (!tier) return null

  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const billingPeriod = await resolveBillingPeriod(ipn, isLifetime)
  if (!verifyUsdPriceMatch(ipn, tier, billingPeriod, pendingOrder)) {
    return null
  }

  const periodEnd = calculatePeriodEnd(billingPeriod)
  const now = new Date().toISOString()
  const orgId = await findOrgIdForUser(userId, db)
  return { d1, db, tier, billingPeriod, periodEnd, now, orgId }
}

async function resolveBillingPeriod(
  ipn: NowPaymentsIpnPayload,
  isLifetime: boolean
): Promise<'monthly' | 'yearly' | 'lifetime'> {
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

async function findOrgIdForUser(
  userId: string,
  db: ReturnType<typeof getDb>
): Promise<string | undefined> {
  const orgId = await resolveOrgId(userId, db)
  return orgId ?? undefined
}
