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

export async function setupDatabaseAndContext(
  ipn: NowPaymentsIpnPayload,
  userId: string
): Promise<FinishedActivationContext | null> {
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
