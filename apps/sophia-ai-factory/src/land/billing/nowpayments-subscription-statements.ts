/**
 * D1 batch statements and new org creation helper for NOWPayments subscription activation.
 * @module billing/nowpayments-subscription-statements
 */

import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'
import { markOrderCompleted } from '@/land/orders/pending-order-repo'
import { stackedPeriodEnd } from './nowpayments-ipn-utils'

export function buildSubscriptionUpdateStatements(
  currentSub: unknown,
  wouldDowngrade: boolean,
  orgId: string,
  tier: Tier,
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  existingPeriodEnd: string | null | undefined,
  userId?: string
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
  if (userId) {
    stmts.push(
      d1.prepare("UPDATE dunning_settings SET dunning_state='current', dunning_state_changed_at=? WHERE user_id=?")
        .bind(now, userId)
    )
  }
  return stmts
}

export async function createNewOrgAndSubscription(
  userId: string,
  tier: Tier,
  _billingPeriod: 'monthly' | 'yearly' | 'lifetime',
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
  try {
    await db
      .from('dunning_settings')
      .update({ dunning_state: 'current', dunning_state_changed_at: now })
      .eq('user_id', userId)
  } catch {
    // non-fatal
  }
}
