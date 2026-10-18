/**
 * Internal D1 persistence and grant resolution helpers for Digital Product Fulfillment
 *
 * Layer: land/commerce
 *
 * @module land/commerce/digital-fulfillment-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';

export interface ExistingFulfillmentRow {
  id: string;
  grant_ref: string | null;
}

export function newFulfillmentId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'cful_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Build the deterministic grant reference for a product + order. */
export function buildGrantRef(assetRef: string | null, orderId: string): string {
  return assetRef ? `access:${assetRef}` : `download:${orderId}`;
}

/**
 * Fetches an existing fulfillment record for an order.
 */
export async function fetchExistingFulfillment(
  db: D1Database,
  orderId: string
): Promise<ExistingFulfillmentRow | null> {
  return db
    .prepare('SELECT id, grant_ref FROM commerce_fulfillments WHERE order_id = ?1 LIMIT 1')
    .bind(orderId)
    .first<ExistingFulfillmentRow>();
}

/**
 * Atomically inserts a pending fulfillment row using ON CONFLICT(order_id) DO NOTHING.
 * Returns the number of rows changed (1 if claimed by this caller, 0 if already claimed).
 */
export async function claimFulfillmentSlot(
  db: D1Database,
  fulfillmentId: string,
  orderId: string,
  productId: string,
  workspaceId: string,
  now: number
): Promise<number> {
  const claim = await db
    .prepare(
      `INSERT INTO commerce_fulfillments
         (id, order_id, product_id, workspace_id, status, grant_ref, error, fulfilled_at, created_at)
       VALUES (?1, ?2, ?3, ?4, 'pending', NULL, NULL, NULL, ?5)
       ON CONFLICT(order_id) DO NOTHING`
    )
    .bind(fulfillmentId, orderId, productId, workspaceId, now)
    .run();

  return claim.meta?.changes ?? 0;
}

/**
 * Resolves the grant reference from the product catalog, falling back to download reference on error.
 */
export async function resolveProductGrantRef(
  db: D1Database,
  productId: string,
  orderId: string
): Promise<string> {
  try {
    const product = await db
      .prepare('SELECT asset_ref FROM commerce_products WHERE id = ?1 LIMIT 1')
      .bind(productId)
      .first<{ asset_ref: string | null }>();
    return buildGrantRef(product?.asset_ref ?? null, orderId);
  } catch (err) {
    logger.warn('[commerce] product lookup failed, using download grant', {
      orderId,
      error: String(err),
    });
    return buildGrantRef(null, orderId);
  }
}

/**
 * Marks the claimed fulfillment row as granted with the resolved grant reference.
 */
export async function updateFulfillmentGranted(
  db: D1Database,
  fulfillmentId: string,
  grantRef: string,
  fulfilledAt: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE commerce_fulfillments
       SET status = 'granted', grant_ref = ?2, fulfilled_at = ?3
       WHERE id = ?1`
    )
    .bind(fulfillmentId, grantRef, fulfilledAt)
    .run();
}
