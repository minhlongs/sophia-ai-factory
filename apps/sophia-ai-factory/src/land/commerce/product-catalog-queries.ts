/**
 * Digital product catalog read and deactivation operations.
 * @module land/commerce/product-catalog-queries
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  rowToProduct,
  type CommerceError,
  type CommerceProduct,
  type ProductRow,
} from './product-model';

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
