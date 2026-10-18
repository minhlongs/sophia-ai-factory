import { NextResponse } from 'next/server';
import { getPayOsTierConfig } from '@/land/payments/payos';
import { logger } from '@/seed/utils/logger-utility';
import { markOrderFailed } from '@/land/orders/pending-order-repo';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

export async function validatePendingPayOsOrder(params: {
  db: DbClient;
  paymentLinkId: number | string;
  orderCode: number | string;
  amount: number;
  lockCreatedAt: string;
}): Promise<{ ok: true; order: PendingOrder; expectedVndAmount: number } | { ok: false; response: NextResponse }> {
  const { db, paymentLinkId, orderCode, amount, lockCreatedAt } = params;

  const { data: orderRow, error: lookupError } = await db
    .from('pending_orders')
    .select('*')
    .eq('provider_payment_id', paymentLinkId)
    .eq('status', 'pending')
    .single();

  if (lookupError && lookupError.code !== 'PGRST116') {
    logger.error('[PayOS Webhook] Pending order lookup failed', new Error(lookupError.message), {
      paymentLinkId,
      orderCode,
    });
    await db
      .from('payment_events')
      .delete()
      .eq('event_id', `payos_${paymentLinkId}`)
      .eq('created_at', lockCreatedAt)
      .eq('processed', 0);
    return { ok: false, response: NextResponse.json({ error: 'Order lookup failed' }, { status: 500 }) };
  }

  const order = orderRow as PendingOrder | null;
  if (!order) {
    logger.warn('[PayOS Webhook] No pending order found for paymentLinkId', { paymentLinkId, orderCode });
    await db
      .from('payment_events')
      .delete()
      .eq('event_id', `payos_${paymentLinkId}`)
      .eq('created_at', lockCreatedAt)
      .eq('processed', 0);
    return { ok: false, response: NextResponse.json({ error: 'Order not found' }, { status: 400 }) };
  }

  const tier = order.tier as Tier;
  const expectedVndAmount = order.amount_vnd ?? getPayOsTierConfig(tier, order.period).vndAmount;

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
