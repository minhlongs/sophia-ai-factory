import { NextResponse } from 'next/server';
import { getPayOsTierConfig } from '@/land/payments/payos';
import { logger } from '@/seed/utils/logger-utility';
import { markOrderFailed } from '@/land/orders/pending-order-repo';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

function checkOrderInvariants(
  order: PendingOrder,
  paymentLinkId: number | string,
  orderCode: number | string,
  currency?: string | null,
): { error: string; status: number } | null {
  if (order.provider_payment_id && String(order.provider_payment_id) !== String(paymentLinkId)) {
    return { error: 'Payment link mismatch', status: 400 };
  }
  if (order.purpose !== undefined && order.purpose !== 'subscription' && order.purpose !== 'contract') {
    return { error: 'Unsupported order purpose', status: 400 };
  }
  if (order.provider_order_code != null && String(order.provider_order_code) !== String(orderCode)) {
    return { error: 'Order code mismatch', status: 400 };
  }
  if (order.period === 'pilot_14d' && order.tier !== 'BASIC') {
    return { error: 'Invalid pilot tier', status: 400 };
  }
  if (order.purpose !== 'contract') return null;
  if (!order.contract_id || !order.invoice_id || order.provider_order_code == null || order.amount_vnd == null) {
    return { error: 'Incomplete contract payment record', status: 500 };
  }
  if (currency !== 'VND') {
    return { error: 'Contract payment currency mismatch', status: 400 };
  }
  return null;
}

export async function validatePendingPayOsOrder(params: {
  db: DbClient;
  paymentLinkId: number | string;
  orderCode: number | string;
  amount: number;
  currency?: string | null;
  lockCreatedAt: string;
}): Promise<{ ok: true; order: PendingOrder; expectedVndAmount: number } | { ok: false; response: NextResponse }> {
  const { db, paymentLinkId, orderCode, amount, currency, lockCreatedAt } = params;
  const releaseLock = async () => db
    .from('payment_events')
    .delete()
    .eq('event_id', `payos_${paymentLinkId}`)
    .eq('created_at', lockCreatedAt)
    .eq('processed', 0);

  let { data: orderRow, error: lookupError } = await db
    .from('pending_orders')
    .select('*')
    .eq('provider_payment_id', paymentLinkId)
    .eq('status', 'pending')
    .single();

  if (!orderRow && (!lookupError || lookupError.code === 'PGRST116')) {
    const fallback = await db
      .from('pending_orders')
      .select('*')
      .eq('provider_order_code', orderCode)
      .eq('status', 'pending')
      .single();
    orderRow = fallback.data;
    lookupError = fallback.error;
  }

  if (lookupError && lookupError.code !== 'PGRST116') {
    logger.error('[PayOS Webhook] Pending order lookup failed', new Error(lookupError.message), {
      paymentLinkId,
      orderCode,
    });
    await releaseLock();
    return { ok: false, response: NextResponse.json({ error: 'Order lookup failed' }, { status: 500 }) };
  }

  const order = orderRow as PendingOrder | null;
  if (!order) {
    logger.warn('[PayOS Webhook] No pending order found for paymentLinkId', { paymentLinkId, orderCode });
    await releaseLock();
    return { ok: false, response: NextResponse.json({ error: 'Order not found' }, { status: 400 }) };
  }

  const invariantFailure = checkOrderInvariants(order, paymentLinkId, orderCode, currency);
  if (invariantFailure) {
    await releaseLock();
    return { ok: false, response: NextResponse.json({ error: invariantFailure.error }, { status: invariantFailure.status }) };
  }

  const tier = order.tier as Tier;
  const expectedVndAmount = order.purpose === 'contract'
    ? order.amount_vnd!
    : order.amount_vnd ?? getPayOsTierConfig(tier, order.period).vndAmount;

  if (amount !== expectedVndAmount) {
    logger.warn('[PayOS Webhook] Payment amount does not match tier price', {
      orderCode,
      orderId: order.order_id,
      amount,
      expected: expectedVndAmount,
    });
    await markOrderFailed(order.order_id, 'amount_mismatch');
    const { error: eventError } = await db
      .from('payment_events')
      .update({ processed: 1 })
      .eq('event_id', `payos_${paymentLinkId}`)
      .eq('created_at', lockCreatedAt)
      .eq('processed', 0);
    if (eventError) throw new Error(`PayOS mismatch event update failed: ${eventError.message}`);
    return { ok: false, response: NextResponse.json({ received: true, status: 'amount_mismatch' }) };
  }

  return { ok: true, order, expectedVndAmount };
}
