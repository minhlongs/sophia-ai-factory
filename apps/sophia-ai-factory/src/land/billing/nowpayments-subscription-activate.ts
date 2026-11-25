/**
 * D1 batch() subscription activation for existing orgs and new org creation.
 * @module billing/nowpayments-subscription-activate
 */

import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'
import { getOrderById } from '@/land/orders/pending-order-repo'
import { wouldDowngradeTier } from './nowpayments-ipn-utils'
import {
  buildSubscriptionUpdateStatements,
  createNewOrgAndSubscription,
} from './nowpayments-subscription-statements'

export async function activateSubscriptionForOrg(
  orgId: string | undefined,
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  db: ReturnType<typeof getDb>
): Promise<void> {
  if (orgId) {
    await processExistingOrgSubscription(orgId, userId, tier, billingPeriod, periodEnd, now, ipn, d1, db)
  } else {
    await createNewOrgAndSubscription(userId, tier, billingPeriod, periodEnd, now, ipn, db)
  }
}

async function processExistingOrgSubscription(
  orgId: string,
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  db: ReturnType<typeof getDb>
): Promise<void> {
  try {
    if (ipn.order_id) {
      let existingOrder: Awaited<ReturnType<typeof getOrderById>> = null
      try {
        existingOrder = await getOrderById(ipn.order_id)
      } catch {
        existingOrder = null
      }
      if (existingOrder?.status === 'completed' && existingOrder.payment_id === ipn.payment_id) {
        logger.info('[NOWPayments] Subscription order already completed for this payment_id — skipping duplicate period stack', {
          orderId: ipn.order_id,
          paymentId: ipn.payment_id,
          orgId,
        })
        return
      }
    }

    const { data: currentSub } = await db.from('subscriptions').select('plan, status, current_period_end').eq('org_id', orgId).single()
    const typedSub = currentSub as { plan?: string; status?: string; current_period_end?: string | null } | null
    const isActiveSub = !typedSub?.status || typedSub.status === 'active'
    const currentPlan = isActiveSub ? (typedSub?.plan ?? '') : ''
    const wouldDowngrade = Boolean(currentPlan) && wouldDowngradeTier(currentPlan, tier)

    const stmts = buildSubscriptionUpdateStatements(
      currentSub, wouldDowngrade, orgId, tier, periodEnd, now, ipn, d1, billingPeriod,
      isActiveSub ? typedSub?.current_period_end : null,
      userId
    )
    await d1.batch(stmts)
  } catch (batchErr) {
    logger.error('[NOWPayments] D1 batch failed — throwing for retry', batchErr instanceof Error ? batchErr : undefined)
    throw batchErr
  }
}
