/**
 * Digital product catalog update mutation.
 * @module land/commerce/product-catalog-mutations
 */

import { getD1 } from '@/seed/db/client';
import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  ProductUpdateSchema,
  type CommerceError,
  type CommerceProduct,
  type ProductRow,
  type ProductUpdate,
} from './product-model';
import { getProduct } from './product-catalog-queries';

/** Update mutable fields. Only provided fields are written; ownership-guarded. */
export async function updateProduct(
  workspaceId: string,
  productId: string,
  patch: ProductUpdate,
): Promise<Result<CommerceProduct, CommerceError>> {
  const parsed = ProductUpdateSchema.safeParse(patch);
  if (!parsed.success) {
    return failure({ code: 'INVALID_INPUT', message: parsed.error.message });
  }
  const data = parsed.data;

  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  try {
    const existing = await db
      .prepare('SELECT * FROM commerce_products WHERE id = ?1 AND workspace_id = ?2 LIMIT 1')
      .bind(productId, workspaceId)
      .first<ProductRow>();
    if (!existing) {
      return failure({ code: 'NOT_FOUND', message: `Product ${productId} not found in workspace` });
    }

    const next = {
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      priceCents: data.priceCents ?? existing.price_cents,
      currency: data.currency ?? existing.currency,
      assetRef: data.assetRef === undefined ? existing.asset_ref : data.assetRef,
      metadata: data.metadata ?? (existing.metadata ? JSON.parse(existing.metadata) : {}),
    };

    const { meta } = await db
      .prepare(
        `UPDATE commerce_products
         SET name = ?3, description = ?4, price_cents = ?5, currency = ?6, asset_ref = ?7, metadata = ?8, updated_at = ?9
         WHERE id = ?1 AND workspace_id = ?2`,
      )
      .bind(
        productId,
        workspaceId,
        next.name,
        next.description,
        next.priceCents,
        next.currency,
        next.assetRef,
        JSON.stringify(next.metadata),
        Date.now(),
      )
      .run();
    if ((meta?.changes ?? 0) === 0) {
      return failure({ code: 'NOT_FOUND', message: `Product ${productId} not found in workspace` });
    }
  } catch (err) {
    logger.error('[commerce] updateProduct failed', toError(err), { productId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }

  return getProduct(productId);
}
