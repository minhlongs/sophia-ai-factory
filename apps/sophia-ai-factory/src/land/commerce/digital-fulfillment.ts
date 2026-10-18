/**
 * Algorithm: digital product fulfillment — grant download/access for a paid
 * order, exactly once.
 *
 * Idempotency is enforced by the commerce_fulfillments UNIQUE(order_id)
 * constraint: the fulfillment row is inserted with
 * INSERT ... ON CONFLICT(order_id) DO NOTHING and meta.changes decides
 * ownership. A duplicate delivery (double IPN) finds the existing row and
 * returns success with alreadyFulfilled=true — no second grant, no error.
 *
 * The grant itself is a deterministic reference (access:<assetRef> or
 * download:<orderId>) persisted on the fulfillment row; no live platform
 * call is made, so fulfillment is safe to retry.
 *
 * Timestamps are MILLISECONDS (performance_events convention).
 *
 * @module land/commerce/digital-fulfillment
 */
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getOrder, markOrderFulfilled } from './commerce-order';
import {
  newFulfillmentId,
  buildGrantRef,
  fetchExistingFulfillment,
  claimFulfillmentSlot,
  resolveProductGrantRef,
  updateFulfillmentGranted,
} from './digital-fulfillment-helpers';

export type FulfillmentErrorCode =
  | 'DB_UNAVAILABLE'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_PAID'
  | 'WRITE_FAILED';

export interface FulfillmentError {
  code: FulfillmentErrorCode;
  message: string;
}

export interface FulfillmentOk {
  fulfillmentId: string;
  orderId: string;
  grantRef: string;
  /** True when a prior run already granted this order. */
  alreadyFulfilled: boolean;
}

export { buildGrantRef };

/**
 * Fulfill a paid order exactly once:
 *   1. Load the order — must exist and be in `paid` state.
 *   2. Atomically claim the fulfillment row (UNIQUE(order_id) lock).
 *   3. Resolve the grant reference from the product's asset_ref.
 *   4. Mark the fulfillment granted + the order fulfilled.
 *
 * Returns success(alreadyFulfilled=true) for a duplicate delivery.
 */
export async function fulfillOrder(orderId: string): Promise<Result<FulfillmentOk, FulfillmentError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  const orderResult = await getOrder(orderId);
  if (!orderResult.ok) {
    return failure({
      code: 'ORDER_NOT_FOUND',
      message: `Order ${orderId} not found: ${orderResult.error.message}`,
    });
  }
  const order = orderResult.value;

  if (order.status === 'fulfilled') {
    const existing = await fetchExistingFulfillment(db, orderId);
    return success({
      fulfillmentId: existing?.id ?? '',
      orderId,
      grantRef: existing?.grant_ref ?? '',
      alreadyFulfilled: true,
    });
  }

  if (order.status !== 'paid') {
    return failure({
      code: 'ORDER_NOT_PAID',
      message: `Order ${orderId} is ${order.status}, expected paid`,
    });
  }

  const fulfillmentId = newFulfillmentId();
  const now = Date.now();
  try {
    const changes = await claimFulfillmentSlot(
      db,
      fulfillmentId,
      orderId,
      order.productId,
      order.workspaceId,
      now
    );

    if (changes === 0) {
      const existing = await fetchExistingFulfillment(db, orderId);
      return success({
        fulfillmentId: existing?.id ?? '',
        orderId,
        grantRef: existing?.grant_ref ?? '',
        alreadyFulfilled: true,
      });
    }
  } catch (err) {
    logger.error('[commerce] fulfillment claim failed', toError(err), { orderId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }

  const grantRef = await resolveProductGrantRef(db, order.productId, orderId);

  try {
    await updateFulfillmentGranted(db, fulfillmentId, grantRef, Date.now());
  } catch (err) {
    logger.error('[commerce] fulfillment grant failed', toError(err), { orderId, fulfillmentId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }

  const fulfilled = await markOrderFulfilled(orderId);
  if (!fulfilled.ok) {
    return failure({ code: 'WRITE_FAILED', message: fulfilled.error.message });
  }

  logger.info('[commerce] Order fulfilled', { orderId, fulfillmentId, grantRef });
  return success({ fulfillmentId, orderId, grantRef, alreadyFulfilled: false });
}
