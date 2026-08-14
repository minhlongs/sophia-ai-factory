/**
 * D1 batch() subscription activation for existing orgs and new org creation.
 * @module billing/nowpayments-subscription-activate
 */

import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'
import { markOrderCompleted } from '@/land/orders/pending-order-repo'
import { stackedPeriodEnd, wouldDowngradeTier } from './nowpayments-ipn-utils'

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
    const { data: currentSub } = await db.from('subscriptions').select('plan, current_period_end').eq('org_id', orgId).single()
    const currentPlan = (currentSub as { plan?: string } | null)?.plan ?? ''
    const wouldDowngrade = wouldDowngradeTier(currentPlan, tier)

    const stmts = buildSubscriptionUpdateStatements(
      currentSub, wouldDowngrade, orgId, tier, periodEnd, now, ipn, d1, billingPeriod,
      (currentSub as { current_period_end?: string | null } | null)?.current_period_end
    )
    await d1.batch(stmts)
  } catch (batchErr) {
    logger.error('[NOWPayments] D1 batch failed — throwing for retry', batchErr instanceof Error ? batchErr : undefined)
    throw batchErr
  }
}

function buildSubscriptionUpdateStatements(
  currentSub: unknown,
  wouldDowngrade: boolean,
  orgId: string,
  tier: Tier,
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  existingPeriodEnd: string | null | undefined
): ReturnType<typeof d1.prepare>[] {
  const stmts = currentSub
    ? wouldDowngrade
      ? [
        d1.prepare('UPDATE subscriptions SET current_period_end=?, updated_at=? WHERE org_id=?')
          .bind(periodEnd, now, orgId),
        d1.prepare('UPDATE organizations SET updated_at=? WHERE id=?')
          .bind(now, orgId),
        d1.prepare('UPDATE tier_change_events SET resolved=?, resolved_at=?, note=? WHERE org_id=? AND resolved=?')
          .bind(1, now, 'Blocked: admin-set MASTER tier protected from webhook downgrade', orgId, 0),
      ]
      : [
        d1.prepare('UPDATE subscriptions SET plan=?, status=?, current_period_end=?, updated_at=? WHERE org_id=?')
          .bind(
            tier.toLowerCase(), 'active',
            stackedPeriodEnd(existingPeriodEnd, billingPeriod, now, periodEnd),
            now, orgId
          ),
        d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
          .bind(tier.toLowerCase(), now, orgId),
      ]
    : [
      d1.prepare('INSERT INTO subscriptions (org_id, plan, status, current_period_start, current_period_end) VALUES (?,?,?,?,?)')
        .bind(orgId, tier.toLowerCase(), 'active', now, periodEnd),
      d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
        .bind(tier.toLowerCase(), now, orgId),
    ]

  if (ipn.order_id) {
    stmts.push(
      d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
        .bind('completed', ipn.payment_id, now, ipn.order_id)
    )
  }
  return stmts
}

async function createNewOrgAndSubscription(
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>
): Promise<void> {
  logger.warn('[NOWPayments] No org membership found for userId, creating new org', { userId })
  const { data: newOrg } = await db.from('organizations').insert({ name: `User ${userId}`, plan: tier.toLowerCase() }).select('id').single()
  if (newOrg?.id) {
    await db.from('org_members').insert({ org_id: newOrg.id, user_id: userId, role: 'owner' })
    await db.from('subscriptions').insert({ org_id: newOrg.id, plan: tier.toLowerCase(), status: 'active', current_period_start: now, current_period_end: periodEnd })
  }
  if (ipn.order_id) {
    await markOrderCompleted(ipn.order_id, ipn.payment_id)
  }
}
