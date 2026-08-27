/**
 * Commerce order lifecycle — pending → paid → fulfilled.
 *
 * Orders start `pending` and move to `paid` when the payment provider
 * confirms the charge. markOrderPaid is idempotent (double-IPN safe).
 * Revenue event ids follow `commerce_{productId}_{orderId}` so ingestion
 * dedupes per order. Timestamps are MILLISECONDS.
 *
 * @module land/commerce/commerce-order
 */
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  OrderInputSchema,
  newOrderId,
  rowToOrder,
  type CommerceOrder,
  type OrderError,
  type OrderInput,
  type OrderRow,
} from './order-model';

export {
  ORDER_STATUSES,
  OrderInputSchema,
  buildCommerceEventId,
  type CommerceOrder,
  type OrderErrorCode,
  type OrderError,
  type OrderInput,
  type OrderStatus,
} from './order-model';

/** Create a pending order; amount = product price × quantity (price snapshot). */
export async function createOrder(input: OrderInput): Promise<Result<CommerceOrder, OrderError>> {
  const parsed = OrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure({ code: 'INVALID_INPUT', message: parsed.error.message });
  }
  const data = parsed.data;

  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  const product = await db
    .prepare('SELECT price_cents, currency, is_active FROM commerce_products WHERE id = ?1 LIMIT 1')
    .bind(data.productId)
    .first<{ price_cents: number; currency: string; is_active: number }>();

  if (!product) {
    return failure({ code: 'PRODUCT_NOT_FOUND', message: `Product ${data.productId} not found` });
  }
  if (Number(product.is_active) !== 1) {
    return failure({ code: 'PRODUCT_INACTIVE', message: `Product ${data.productId} is not active` });
  }

  const id = newOrderId();
  const quantity = data.quantity ?? 1;
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO commerce_orders
           (id, workspace_id, product_id, buyer_user_id, quantity, amount_cents, currency, status, payment_provider, external_payment_id, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', 'nowpayments', NULL, ?8, ?9, ?9)`,
      )
      .bind(
        id,
        data.workspaceId,
        data.productId,
        data.buyerUserId ?? null,
        quantity,
        product.price_cents * quantity,
        product.currency,
        JSON.stringify(data.metadata ?? {}),
        now,
      )
      .run();
  } catch (err) {
    logger.error('[commerce] createOrder failed', toError(err), { productId: data.productId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }

  return getOrder(id);
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

export interface MarkPaidOk {
  order: CommerceOrder;
  /** True when this call performed the transition; false when already paid. */
  transitioned: boolean;
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
      // Lost the pending→paid race: report the true current state.
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
