/**
 * Digital product catalog. A CommerceProduct is a sellable digital good
 * (download or access grant) owned by a workspace. CRUD is idempotent on the
 * primary key and returns Result<T,E> — never throws for expected failures.
 * Timestamps are MILLISECONDS (performance_events convention).
 *
 * @module land/commerce/product-catalog
 */
import { getD1 } from '@/seed/db/client';
import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  ProductInputSchema,
  ProductUpdateSchema,
  newProductId,
  type CommerceError,
  type CommerceProduct,
  type ProductInput,
  type ProductRow,
  type ProductUpdate,
} from './product-model';
import { getProduct } from './product-catalog-queries';

export {
  PRODUCT_TYPES,
  ProductInputSchema,
  ProductUpdateSchema,
  type CommerceError,
  type CommerceErrorCode,
  type CommerceProduct,
  type ProductInput,
  type ProductType,
  type ProductUpdate,
} from './product-model';
export { getProduct, listProducts, deactivateProduct } from './product-catalog-queries';

/** Create a digital product. Returns the persisted product or a failure. */
export async function createProduct(
  input: ProductInput,
): Promise<Result<CommerceProduct, CommerceError>> {
  const parsed = ProductInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure({ code: 'INVALID_INPUT', message: parsed.error.message });
  }
  const data = parsed.data;

  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  const id = newProductId();
  const now = Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO commerce_products
           (id, workspace_id, name, description, product_type, price_cents, currency, asset_ref, is_active, metadata, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10, ?10)`,
      )
      .bind(
        id,
        data.workspaceId,
        data.name,
        data.description ?? '',
        data.productType ?? 'digital',
        data.priceCents,
        data.currency ?? 'USD',
        data.assetRef ?? null,
        JSON.stringify(data.metadata ?? {}),
        now,
      )
      .run();
  } catch (err) {
    logger.error('[commerce] createProduct failed', toError(err), { workspaceId: data.workspaceId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }

  return getProduct(id);
}

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
