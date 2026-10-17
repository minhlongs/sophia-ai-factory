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
import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  OrderInputSchema,
  newOrderId,
  type CommerceOrder,
  type OrderError,
  type OrderInput,
} from './order-model';
import {
  getOrder,
  markOrderFulfilled,
  markOrderPaid,
  type MarkPaidOk,
} from './commerce-order-transitions';

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

export { getOrder, markOrderPaid, markOrderFulfilled, type MarkPaidOk };

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
