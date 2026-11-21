import { matchesPayOsIdentity } from '@/app/api/webhooks/payos/modules/payos-payment-identity';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import { logger } from '@/seed/utils/logger-utility';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { PAID_PILOT_DURATION_DAYS } from '@/tree/finance/pilot-unit-economics-types';
import { getPayOsTierConfig, type PayOsBillingPeriod } from '@/land/payments/payos';
import type { Tier } from '@/seed/types';
import type { D1Client } from '@/seed/db/client';

export interface ValidatedPayOsOrder {
  orderId: string;
  userId: string;
  tier: Tier;
  billingPeriod: 'lifetime' | 'yearly' | 'monthly' | 'pilot_14d';
  periodEnd: string;
  orgId: string;
  subaccountId: string | undefined;
}

type PendingOrderRow = {
  order_id: string;
  user_id: string;
  tier: string;
  period?: string;
  amount_vnd?: number | null;
  invoice_url: string | null;
  provider_payment_id?: string | null;
  provider_order_code?: number | string | null;
  status?: string;
  subaccount_id?: string;
};

function normalizePayOsPeriod(orderPeriod: string | undefined): PayOsBillingPeriod {
  if (orderPeriod === 'pilot_14d' || orderPeriod === 'yearly' || orderPeriod === 'lifetime') {
    return orderPeriod;
  }
  return 'monthly';
}

function resolveOrderBillingWindow(
  tier: Tier,
  orderPeriod: string | undefined,
): { billingPeriod: ValidatedPayOsOrder['billingPeriod']; periodEnd: string } {
  if (UNIFIED_TIERS[tier]?.billingType === 'lifetime') {
    return { billingPeriod: 'lifetime', periodEnd: new Date('2099-12-31T23:59:59Z').toISOString() };
  }
  if (orderPeriod === 'pilot_14d') {
    return {
      billingPeriod: 'pilot_14d',
      periodEnd: new Date(Date.now() + PAID_PILOT_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (orderPeriod === 'yearly') {
    return {
      billingPeriod: 'yearly',
      periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return {
    billingPeriod: 'monthly',
    periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function findAndValidatePayOsOrder(params: {
  db: D1Client;
  orderCode: string | number;
  paymentLinkId: string;
  amount: number;
  eventId: string;
}): Promise<{ ok: true; data: ValidatedPayOsOrder } | { ok: false; error: string; status: number }> {
  const { db, orderCode, paymentLinkId, amount, eventId } = params;
  const releaseEvent = async () => {}; // The route owns lease-qualified cleanup.

  const { data: pendingOrders, error: pendingOrdersError } = await db
    .from('pending_orders')
    .select('*')
    .eq('payment_method', 'payos')
    .eq('status', 'pending');

  if (pendingOrdersError) {
    logger.error('[PayOS IPN] Failed to query pending orders', { pendingOrdersError });
    await releaseEvent();
    return { ok: false, error: 'Database query failure', status: 500 };
  }
  if (!pendingOrders || pendingOrders.length === 0) {
    logger.error('[PayOS IPN] No pending orders');
    await releaseEvent();
    return { ok: false, error: 'No pending orders', status: 400 };
  }

  const orders = pendingOrders as PendingOrderRow[];
  const matchOrder = orders.find(o => matchesPayOsIdentity(o as PendingOrder, orderCode, paymentLinkId));
  if (!matchOrder) {
    logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode });
    await releaseEvent();
    return { ok: false, error: 'Order not found', status: 400 };
  }
  if (matchOrder.status && matchOrder.status !== 'pending') {
    await releaseEvent();
    return { ok: false, error: 'Order already settled', status: 409 };
  }

  const tier = matchOrder.tier as Tier;
  if (matchOrder.period === 'pilot_14d') {
    return { ok: false, error: 'Pilot payment requires manual review / Thanh toán Pilot cần được kiểm tra thủ công', status: 409 };
  }

  const expectedVndAmount =
    matchOrder.amount_vnd ?? getPayOsTierConfig(tier, normalizePayOsPeriod(matchOrder.period)).vndAmount;
  if (amount !== expectedVndAmount) {
    logger.error('[PayOS IPN] Amount mismatch', { orderCode, received: amount, expected: expectedVndAmount, tier });
    await releaseEvent();
    return { ok: false, error: 'Amount mismatch', status: 400 };
  }

  const orgId = await resolveOrgId(matchOrder.user_id, db);
  if (!orgId) {
    logger.error('[PayOS IPN] Unable to resolve organization for paid order', {
      userId: matchOrder.user_id,
      orderId: matchOrder.order_id,
    });
    await releaseEvent();
    return { ok: false, error: 'Organization not found', status: 500 };
  }

  const { billingPeriod, periodEnd } = resolveOrderBillingWindow(tier, matchOrder.period);
  return {
    ok: true,
    data: {
      orderId: matchOrder.order_id,
      userId: matchOrder.user_id,
      tier,
      billingPeriod,
      periodEnd,
      orgId,
      subaccountId: matchOrder.subaccount_id,
    },
  };
}
