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

function newFulfillmentId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'cful_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build the deterministic grant reference for a product + order. */
export function buildGrantRef(assetRef: string | null, orderId: string): string {
  return assetRef ? `access:${assetRef}` : `download:${orderId}`;
}

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
    const existing = await db
      .prepare('SELECT id, grant_ref FROM commerce_fulfillments WHERE order_id = ?1 LIMIT 1')
      .bind(orderId)
      .first<{ id: string; grant_ref: string | null }>();
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

  // Atomic claim: UNIQUE(order_id) makes this a single-writer gate.
  const fulfillmentId = newFulfillmentId();
  const now = Date.now();
  try {
    const claim = await db
      .prepare(
        `INSERT INTO commerce_fulfillments
           (id, order_id, product_id, workspace_id, status, grant_ref, error, fulfilled_at, created_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', NULL, NULL, NULL, ?5)
         ON CONFLICT(order_id) DO NOTHING`,
      )
      .bind(fulfillmentId, orderId, order.productId, order.workspaceId, now)
      .run();

    if ((claim.meta?.changes ?? 0) === 0) {
      // Another run claimed it first — report the existing grant if present.
      const existing = await db
        .prepare('SELECT id, grant_ref FROM commerce_fulfillments WHERE order_id = ?1 LIMIT 1')
        .bind(orderId)
        .first<{ id: string; grant_ref: string | null }>();
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

  // Resolve the grant from the product catalog.
  let grantRef = buildGrantRef(null, orderId);
  try {
    const product = await db
      .prepare('SELECT asset_ref FROM commerce_products WHERE id = ?1 LIMIT 1')
      .bind(order.productId)
      .first<{ asset_ref: string | null }>();
    grantRef = buildGrantRef(product?.asset_ref ?? null, orderId);
  } catch (err) {
    // Non-fatal: fall back to the download reference.
    logger.warn('[commerce] product lookup failed, using download grant', {
      orderId,
      error: String(err),
    });
  }

  try {
    await db
      .prepare(
        `UPDATE commerce_fulfillments
         SET status = 'granted', grant_ref = ?2, fulfilled_at = ?3
         WHERE id = ?1`,
      )
      .bind(fulfillmentId, grantRef, Date.now())
      .run();
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
