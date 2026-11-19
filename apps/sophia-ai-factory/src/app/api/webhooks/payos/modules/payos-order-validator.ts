import { NextResponse } from 'next/server';
import { validatePayOsPaymentIdentity } from './payos-payment-identity';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import type { DbClient } from './payos-idempotency';

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

  const identity = await validatePayOsPaymentIdentity({ db, paymentLinkId, orderCode, amount, currency });
  if (!identity.ok) {
    await releaseLock();
    return { ok: false, response: NextResponse.json({ error: identity.error }, { status: identity.status }) };
  }
  if (identity.order.status !== 'pending') {
    await releaseLock();
    return { ok: false, response: NextResponse.json({ received: true, duplicate: true }) };
  }
  return identity;
}
