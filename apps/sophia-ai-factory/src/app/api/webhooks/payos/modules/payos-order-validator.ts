import { NextResponse } from 'next/server';
import { getPayOsTierConfig } from '@/land/payments/payos';
import { logger } from '@/seed/utils/logger-utility';
import { markOrderFailed } from '@/land/orders/pending-order-repo';
import type { Tier } from '@/seed/types';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

export const UNDERPAYMENT_THRESHOLD = 0.99;

export async function validatePendingPayOsOrder(params: {
  db: DbClient;
  paymentLinkId: number | string;
  orderCode: number | string;
  amount: number;
}): Promise<{ ok: true; order: PendingOrder; expectedVndAmount: number } | { ok: false; response: NextResponse }> {
  const { db, paymentLinkId, orderCode, amount } = params;

  const { data: orderRow } = await db
    .from('pending_orders')
    .select('*')
    .eq('provider_payment_id', paymentLinkId)
    .eq('status', 'pending')
    .single();

  const order = orderRow as PendingOrder | null;
  if (!order) {
    logger.warn('[PayOS Webhook] No pending order found for paymentLinkId', { paymentLinkId, orderCode });
    await db.from('payment_events').delete().eq('event_id', `payos_${paymentLinkId}`);
    return { ok: false, response: NextResponse.json({ error: 'Order not found' }, { status: 400 }) };
  }

  const tier = order.tier as Tier;
  const expectedVndAmount = getPayOsTierConfig(tier).vndAmount;

  if (amount < expectedVndAmount * UNDERPAYMENT_THRESHOLD) {
    logger.warn('[PayOS Webhook] Underpayment detected', {
      orderCode,
      orderId: order.order_id,
      amount,
      expected: expectedVndAmount,
      threshold: UNDERPAYMENT_THRESHOLD,
    });
    await markOrderFailed(order.order_id, 'underpaid');
    await db.from('payment_events').update({ processed: 1 }).eq('event_id', `payos_${paymentLinkId}`);
    return { ok: false, response: NextResponse.json({ received: true, status: 'underpaid' }) };
  }

  if (amount > expectedVndAmount * 1.01) {
    logger.warn('[PayOS Webhook] Overpaid', { orderCode, expected: expectedVndAmount, actual: amount });
  }

  return { ok: true, order, expectedVndAmount };
}
