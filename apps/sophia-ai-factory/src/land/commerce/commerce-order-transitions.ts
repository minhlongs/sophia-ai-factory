/**
 * Commerce order state transitions — pending → paid → fulfilled.
 *
 * @module land/commerce/commerce-order-transitions
 */
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { rowToOrder, type CommerceOrder, type OrderError, type OrderRow } from './order-model';

export interface MarkPaidOk {
  order: CommerceOrder;
  /** True when this call performed the transition; false when already paid. */
  transitioned: boolean;
}

/** Fetch a single order by id. NOT_FOUND when absent. */
export async function getOrder(id: string): Promise<Result<CommerceOrder, OrderError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  try {
    const row = await db
      .prepare('SELECT * FROM commerce_orders WHERE id = ?1 LIMIT 1')
      .bind(id)
      .first<OrderRow>();
    if (!row) return failure({ code: 'NOT_FOUND', message: `Order ${id} not found` });
    return success(rowToOrder(row));
  } catch (err) {
    logger.error('[commerce] getOrder failed', toError(err), { id });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }
}

/**
 * Transition an order to `paid`. Idempotent: re-confirming an already-paid
 * (or fulfilled) order returns success with transitioned=false instead of
 * erroring, so duplicate IPN deliveries are safe.
 */
export async function markOrderPaid(
  orderId: string,
  externalPaymentId: string,
): Promise<Result<MarkPaidOk, OrderError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  const current = await getOrder(orderId);
  if (!current.ok) return current;

  if (current.value.status === 'paid' || current.value.status === 'fulfilled') {
    return success({ order: current.value, transitioned: false });
  }

  try {
    const { meta } = await db
      .prepare(
        `UPDATE commerce_orders SET status = 'paid', external_payment_id = ?2, updated_at = ?3
         WHERE id = ?1 AND status = 'pending'`,
      )
      .bind(orderId, externalPaymentId, Date.now())
      .run();
    if ((meta?.changes ?? 0) === 0) {
      const reread = await getOrder(orderId);
      if (!reread.ok) return reread;
      if (reread.value.status === 'paid' || reread.value.status === 'fulfilled') {
        return success({ order: reread.value, transitioned: false });
      }
      return failure({
        code: 'WRITE_FAILED',
        message: `Order ${orderId} is ${reread.value.status}; cannot mark paid`,
      });
    }
  } catch (err) {
    logger.error('[commerce] markOrderPaid failed', toError(err), { orderId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }

  const updated = await getOrder(orderId);
  if (!updated.ok) return updated;
  return success({ order: updated.value, transitioned: true });
}

/** Mark an order fulfilled after its digital grant succeeds. */
export async function markOrderFulfilled(orderId: string): Promise<Result<void, OrderError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  try {
    await db
      .prepare(`UPDATE commerce_orders SET status = 'fulfilled', updated_at = ?2 WHERE id = ?1`)
      .bind(orderId, Date.now())
      .run();
    return success(undefined);
  } catch (err) {
    logger.error('[commerce] markOrderFulfilled failed', toError(err), { orderId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }
}
