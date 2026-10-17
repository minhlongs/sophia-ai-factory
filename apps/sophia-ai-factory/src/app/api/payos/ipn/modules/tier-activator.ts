import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { getPayOsTierConfig } from '@/land/payments/payos';
import type { Tier } from '@/seed/types';
import type { D1Client } from '@/seed/db/client';
import {
  commitPayOsSubscriptionBatch,
  runPayOsPostActivationEffects,
} from './tier-activator-effects';
export {
  commitPayOsSubscriptionBatch,
  runPayOsPostActivationEffects,
  type PayOsPostActivationParams,
} from './tier-activator-effects';

export interface ActivateTierParams {
  db: D1Client;
  d1: D1Database;
  orderCode: string | number;
  paymentLinkId: string;
  amount: number;
  eventId: string;
}

export async function activatePayOsTier({
  db,
  d1,
  orderCode,
  paymentLinkId,
  amount,
  eventId,
}: ActivateTierParams): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: pendingOrders, error: pendingOrdersError } = await db
    .from('pending_orders')
    .select('*')
    .eq('payment_method', 'payos')
    .eq('status', 'pending');

  if (pendingOrdersError) {
    logger.error('[PayOS IPN] Failed to query pending orders', { pendingOrdersError });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Database query failure', status: 500 };
  }
  if (!pendingOrders || pendingOrders.length === 0) {
    logger.error('[PayOS IPN] No pending orders');
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'No pending orders', status: 400 };
  }

  const orders = pendingOrders as Array<{
    order_id: string;
    user_id: string;
    tier: string;
    invoice_url: string | null;
  }> | null;
  const matchOrder = orders?.find(
    (o) => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode))
  );

  if (!matchOrder) {
    logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Order not found', status: 400 };
  }

  const tier = matchOrder.tier as Tier;
  const expectedVndAmount = getPayOsTierConfig(tier).vndAmount;
  if (amount !== expectedVndAmount) {
    logger.error('[PayOS IPN] Amount mismatch', {
      orderCode,
      received: amount,
      expected: expectedVndAmount,
      tier,
    });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Amount mismatch', status: 400 };
  }

  const userId = matchOrder.user_id;
  const orderId = matchOrder.order_id;
  const orderPeriod = (matchOrder as Record<string, unknown> | undefined)?.period as string | undefined;
  const now = new Date().toISOString();
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime';
  const billingPeriod = isLifetime ? 'lifetime' : orderPeriod === 'yearly' ? 'yearly' : 'monthly';
  const periodEnd =
    billingPeriod === 'lifetime'
      ? new Date('2099-12-31T23:59:59Z').toISOString()
      : billingPeriod === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const orgId = await resolveOrgId(userId, db);
  if (!orgId) {
    logger.error('[PayOS IPN] Unable to resolve organization for paid order', { userId, orderId });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Organization not found', status: 500 };
  }

  await commitPayOsSubscriptionBatch({
    db,
    d1,
    orgId,
    tier,
    periodEnd,
    now,
    orderCode,
    orderId,
  });

  const orderSubaccountId = (matchOrder as Record<string, unknown>)?.subaccount_id as string | undefined;
  await runPayOsPostActivationEffects({
    db,
    d1,
    userId,
    orgId,
    tier,
    billingPeriod,
    periodEnd,
    orderCode,
    orderId,
    amount,
    subaccountId: orderSubaccountId,
  });

  await db.from('payos_events').update({ processed: 1, amount }).eq('event_id', eventId);
  logger.info('[PayOS IPN] Tier activated', { userId, orgId, tier, orderCode, amount });
  return { ok: true };
}
