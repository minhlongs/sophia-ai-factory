import { resolveOrgId } from '@/seed/auth/workspace-access';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { markOrderCompleted } from '@/land/orders/pending-order-repo';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

export interface SubscriptionActivationResult {
  orgId: string;
  periodEnd: string;
  isLifetime: boolean;
}

export function calculatePayOsPeriodEnd(tier: Tier, orderPeriod?: string): { isLifetime: boolean; periodEnd: string } {
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime';
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : orderPeriod === 'yearly'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { isLifetime, periodEnd };
}

export async function activatePayOsSubscription(params: {
  db: DbClient;
  userId: string;
  tier: Tier;
  order: PendingOrder;
  paymentLinkId: number | string;
}): Promise<SubscriptionActivationResult> {
  const { db, userId, tier, order, paymentLinkId } = params;
  const now = new Date().toISOString();
  const { isLifetime, periodEnd } = calculatePayOsPeriodEnd(tier, order.period);

  let orgId = (await resolveOrgId(userId, db)) ?? undefined;

  if (orgId) {
    const { data: existingSub } = await db
      .from('subscriptions')
      .select('id')
      .eq('org_id', orgId)
      .single();

    if (existingSub) {
      await db
        .from('subscriptions')
        .update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now })
        .eq('org_id', orgId);
    } else {
      await db.from('subscriptions').insert({
        org_id: orgId,
        plan: tier.toLowerCase(),
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
      });
    }

    await db
      .from('organizations')
      .update({ plan: tier.toLowerCase(), updated_at: now })
      .eq('id', orgId);
  } else {
    logger.warn('[PayOS Webhook] No org membership found for userId, creating new org', { userId });
    const insertResult = await db
      .from('organizations')
      .insert({ name: `User ${userId}`, plan: tier.toLowerCase() })
      .select('id')
      .single();

    const newOrg = insertResult.data as { id: string } | null;
    if (newOrg?.id) {
      orgId = newOrg.id;
      await db.from('org_members').insert({ org_id: newOrg.id, user_id: userId, role: 'owner' });
      await db.from('subscriptions').insert({
        org_id: newOrg.id,
        plan: tier.toLowerCase(),
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
      });
    }
  }

  // Complete the pending order
  await markOrderCompleted(order.order_id, `payos_${paymentLinkId}`);

  // Mark event as processed
  await db.from('payment_events').update({ processed: 1 }).eq('event_id', `payos_${paymentLinkId}`);

  return { orgId: orgId ?? userId, periodEnd, isLifetime };
}
