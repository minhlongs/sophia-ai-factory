/**
 * Digital product catalog. A CommerceProduct is a sellable digital good
 * (download or access grant) owned by a workspace. CRUD is idempotent on the
 * primary key and returns Result<T,E> — never throws for expected failures.
 * Timestamps are MILLISECONDS (performance_events convention).
 *
 * @module land/commerce/product-catalog
 */
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  ProductInputSchema,
  ProductUpdateSchema,
  newProductId,
  rowToProduct,
  type CommerceError,
  type CommerceProduct,
  type ProductInput,
  type ProductRow,
  type ProductUpdate,
} from './product-model';

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

/** Fetch a single product by id. NOT_FOUND when absent. */
export async function getProduct(id: string): Promise<Result<CommerceProduct, CommerceError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  try {
    const row = await db
      .prepare('SELECT * FROM commerce_products WHERE id = ?1 LIMIT 1')
      .bind(id)
      .first<ProductRow>();
    if (!row) return failure({ code: 'NOT_FOUND', message: `Product ${id} not found` });
    return success(rowToProduct(row));
  } catch (err) {
    logger.error('[commerce] getProduct failed', toError(err), { id });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }
}

/** List active products for a workspace, newest first. */
export async function listProducts(
  workspaceId: string,
): Promise<Result<CommerceProduct[], CommerceError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  try {
    const { results } = await db
      .prepare(
        'SELECT * FROM commerce_products WHERE workspace_id = ?1 AND is_active = 1 ORDER BY created_at DESC',
      )
      .bind(workspaceId)
      .all<ProductRow>();
    return success((results ?? []).map(rowToProduct));
  } catch (err) {
    logger.error('[commerce] listProducts failed', toError(err), { workspaceId });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }
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

/** Soft-deactivate a product (never hard-delete — orders reference it). */
export async function deactivateProduct(id: string): Promise<Result<void, CommerceError>> {
  const db = await getD1();
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 binding not available' });

  try {
    const { meta } = await db
      .prepare('UPDATE commerce_products SET is_active = 0, updated_at = ?2 WHERE id = ?1')
      .bind(id, Date.now())
      .run();
    if ((meta?.changes ?? 0) === 0) {
      return failure({ code: 'NOT_FOUND', message: `Product ${id} not found` });
    }
    return success(undefined);
  } catch (err) {
    logger.error('[commerce] deactivateProduct failed', toError(err), { id });
    return failure({ code: 'WRITE_FAILED', message: toError(err).message });
  }
}
