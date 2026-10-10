import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { markOrderFailed } from '@/land/orders/pending-order-repo';
import type { D1Client } from '@/seed/db/client';

export type LockResult =
  | { status: 'won_lock' }
  | { status: 'already_processed' }
  | { status: 'already_processing' }
  | { status: 'error'; message: string; statusCode: number };

export async function acquireEventLock(
  d1: D1Database,
  eventId: string,
  orderCode: string | number,
  success: boolean,
  amount: number,
  bodyJson: unknown
): Promise<LockResult> {
  const { results: insertResults } = await d1
    .prepare(
      `INSERT INTO payos_events (event_id, order_code, status, amount, currency, payload, processed, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)
       ON CONFLICT(event_id) DO NOTHING
       RETURNING processed`
    )
    .bind(
      eventId,
      String(orderCode),
      success ? 'PAID' : 'CANCELLED',
      amount || 0,
      'VND',
      JSON.stringify(bodyJson),
      new Date().toISOString()
    )
    .all<{ processed: number }>();

  const wonTheLock = insertResults && insertResults.length > 0;
  if (wonTheLock) {
    return { status: 'won_lock' };
  }

  let existing: { processed: number } | null = null;
  try {
    existing = await d1
      .prepare(`SELECT processed FROM payos_events WHERE event_id = ?1 LIMIT 1`)
      .bind(eventId)
      .first<{ processed: number }>();
  } catch {
    return { status: 'error', message: 'Internal processing error', statusCode: 500 };
  }

  if (existing && existing.processed === 1) {
    return { status: 'already_processed' };
  }
  return { status: 'already_processing' };
}

export async function handleFailedPayment(
  db: D1Client,
  d1: D1Database,
  eventId: string,
  orderCode: string | number,
  paymentLinkId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: pendingOrders, error: pendingOrdersError } = await db
    .from('pending_orders')
    .select('*')
    .eq('payment_method', 'payos')
    .eq('status', 'pending');

  if (pendingOrdersError || !pendingOrders) {
    logger.error('[PayOS IPN] Failed to query pending_orders for cancellation', { pendingOrdersError });
    await db.from('payos_events').delete().eq('event_id', eventId);
    return { ok: false, error: 'Database query failure' };
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

  if (matchOrder) {
    try {
      await markOrderFailed(matchOrder.order_id, 'payos_cancelled');
    } catch (err) {
      logger.warn('[PayOS IPN] Failed to mark order failed', {
        orderId: matchOrder.order_id,
        error: String(err),
      });
    }
  } else {
    logger.warn('[PayOS IPN] Cancellation received but no matching pending order found', {
      paymentLinkId,
      orderCode,
    });
  }

  await db.from('payos_events').update({ processed: 1 }).eq('event_id', eventId);
  logger.info('[PayOS IPN] Payment not successful', { orderCode, success: false });
  return { ok: true };
}
