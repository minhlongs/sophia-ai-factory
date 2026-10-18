/**
 * D1 batch() subscription activation for existing orgs and new org creation.
 * @module billing/nowpayments-subscription-activate
 */

import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'
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
    const { data: currentSub } = await db.from('subscriptions').select('plan, current_period_end').eq('org_id', orgId).single()
    const currentPlan = (currentSub as { plan?: string } | null)?.plan ?? ''
    const wouldDowngrade = wouldDowngradeTier(currentPlan, tier)

    const stmts = buildSubscriptionUpdateStatements(
      currentSub, wouldDowngrade, orgId, tier, periodEnd, now, ipn, d1, billingPeriod,
      (currentSub as { current_period_end?: string | null } | null)?.current_period_end,
      userId
    )
    await d1.batch(stmts)
  } catch (batchErr) {
    logger.error('[NOWPayments] D1 batch failed — throwing for retry', batchErr instanceof Error ? batchErr : undefined)
    throw batchErr
  }
}
