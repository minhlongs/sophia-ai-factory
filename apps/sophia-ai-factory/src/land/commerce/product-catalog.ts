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
  newProductId,
  type CommerceError,
  type CommerceProduct,
  type ProductInput,
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
export { updateProduct } from './product-catalog-mutations';

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
