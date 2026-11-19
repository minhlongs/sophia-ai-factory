import type { D1Client } from '@/seed/db/client';
import type { PendingOrder } from '@/land/orders/pending-order-types';
import { getPayOsTierConfig } from '@/land/payments/payos';
import type { Tier } from '@/seed/types';

/**
 * Returns true only when `order` is an unlinked, pending PayOS contract intent
 * persisted before the provider returned a paymentLinkId/checkoutUrl (e.g. HTTP timeout).
 * Subscription and non-pending orders are never eligible for pre-link correlation.
 */
export function isPreLinkPayOsContractIntent(order: PendingOrder): boolean {
  return (
    order.payment_method === 'payos' &&
    order.purpose === 'contract' &&
    order.status === 'pending' &&
    order.provider_payment_id == null &&
    order.invoice_url == null &&
    typeof order.user_id === 'string' && order.user_id.trim().length > 0 &&
    typeof order.contract_id === 'string' && order.contract_id.trim().length > 0 &&
    typeof order.invoice_id === 'string' && order.invoice_id.trim().length > 0 &&
    typeof order.amount_vnd === 'number' && Number.isSafeInteger(order.amount_vnd) && order.amount_vnd > 0
  );
}

export function matchesPayOsIdentity(order: PendingOrder, orderCode: string | number, paymentLinkId: string | number): boolean {
  const storedCode = String(order.provider_order_code ?? '');
  if (order.payment_method !== 'payos' || !/^[1-9]\d*$/.test(storedCode) ||
      !Number.isSafeInteger(Number(storedCode)) || storedCode !== String(orderCode)) return false;
  if (typeof paymentLinkId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(paymentLinkId)) return false;
  if (order.provider_payment_id != null) return order.provider_payment_id === paymentLinkId;
  if (order.invoice_url != null) {
    // Compatibility is restricted to a complete, exact stored PayOS checkout URL.
    return order.invoice_url === `https://pay.payos.vn/web/${paymentLinkId}`;
  }
  return isPreLinkPayOsContractIntent(order);
}

export async function validatePayOsPaymentIdentity(params: {
  db: D1Client; orderCode: string | number; paymentLinkId: string | number; amount: number; currency?: string | null;
}): Promise<{ ok: true; order: PendingOrder; expectedVndAmount: number } | { ok: false; error: string; status: number }> {
  const { db, orderCode, paymentLinkId, amount, currency } = params;
  if (currency !== 'VND' || !Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, error: 'Invalid amount or currency', status: 400 };
  }
  if (!/^[1-9][0-9]*$/.test(String(orderCode)) || !Number.isSafeInteger(Number(orderCode)) ||
      typeof paymentLinkId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(paymentLinkId)) {
    return { ok: false, error: 'Invalid payment references', status: 400 };
  }
  const { data, error } = await db.from('pending_orders').select('*')
    .eq('provider_order_code', Number(orderCode)).eq('payment_method', 'payos');
  if (error) return { ok: false, error: 'Order lookup failed', status: 500 };
  const matches = ((data ?? []) as unknown as PendingOrder[]).filter(order => matchesPayOsIdentity(order, orderCode, paymentLinkId));
  if (matches.length !== 1) return { ok: false, error: 'Payment identity mismatch', status: 400 };
  const order = matches[0];
  if ((order.purpose != null && !['subscription', 'contract'].includes(order.purpose)) ||
      (order.period === 'pilot_14d' && order.tier !== 'BASIC')) {
    return { ok: false, error: 'Invalid order purpose or tier', status: 400 };
  }
  if (order.purpose === 'contract' && (!order.contract_id || !order.invoice_id || order.amount_vnd == null)) {
    return { ok: false, error: 'Incomplete contract payment record', status: 400 };
  }
  let expectedVndAmount: number;
  try {
    expectedVndAmount = order.amount_vnd ?? getPayOsTierConfig(order.tier as Tier, order.period).vndAmount;
  } catch {
    return { ok: false, error: 'Invalid stored payment order', status: 400 };
  }
  if (!Number.isSafeInteger(expectedVndAmount) || expectedVndAmount <= 0 || amount !== expectedVndAmount) {
    return { ok: false, error: 'Amount mismatch', status: 400 };
  }
  return { ok: true, order, expectedVndAmount };
}

export async function cancelPayOsPayment(params: {
  db: D1Client; order: PendingOrder; eventId: string; lockCreatedAt: string; table: 'payos_events' | 'payment_events';
}): Promise<void> {
  const { db, order, eventId, lockCreatedAt, table } = params;
  if (table !== 'payos_events' && table !== 'payment_events') {
    throw new Error('Invalid event table');
  }
  const raw = db.unwrap();
  const results = await raw.batch([
    raw.prepare(`UPDATE pending_orders SET status='failed'
      WHERE order_id=? AND status='pending' AND payment_method='payos'
      AND provider_payment_id IS ? AND provider_order_code IS ? AND invoice_url IS ?
      AND amount_vnd IS ? AND user_id=? AND tier=? AND period=? AND purpose IS ?
      AND amount_usd_cents IS ? AND contract_id IS ? AND invoice_id IS ?
      AND EXISTS (SELECT 1 FROM ${table} WHERE event_id=? AND created_at=? AND processed=0)`)
      .bind(order.order_id, order.provider_payment_id ?? null, order.provider_order_code ?? null,
        order.invoice_url ?? null, order.amount_vnd ?? null, order.user_id, order.tier, order.period,
        order.purpose ?? null, order.amount_usd_cents ?? null, order.contract_id ?? null, order.invoice_id ?? null,
        eventId, lockCreatedAt),
    raw.prepare(`UPDATE ${table} SET processed=1 WHERE event_id=? AND created_at=? AND processed=0 AND changes()=1`)
      .bind(eventId, lockCreatedAt),
  ]);
  if (results.length !== 2 || results.some(result => !result.success || result.meta.changes !== 1)) {
    throw new Error('Payment cancellation claim failed');
  }
}
