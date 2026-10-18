/**
 * Digital product fulfillment — grant download/access for a paid order, exactly once.
 * Idempotency is enforced by commerce_fulfillments UNIQUE(order_id) with ON CONFLICT DO NOTHING.
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
  alreadyFulfilled: boolean;
}

export { buildGrantRef };

export async function fulfillOrder(orderId: string): Promise<Result<FulfillmentOk, FulfillmentError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  const orderResult = await getOrder(orderId);
  if (!orderResult.ok) {
    return failure({ code: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found: ${orderResult.error.message}` });
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
    return failure({ code: 'ORDER_NOT_PAID', message: `Order ${orderId} is ${order.status}, expected paid` });
  }

  const fulfillmentId = newFulfillmentId();
  const now = Date.now();
  try {
    const changes = await claimFulfillmentSlot(db, fulfillmentId, orderId, order.productId, order.workspaceId, now);
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
