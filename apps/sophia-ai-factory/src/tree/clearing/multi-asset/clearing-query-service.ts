/**
 * Multi-Asset Clearing Queries & Pool Lookups
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/clearing-query-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClearingAsset,
  ClearingBatchStatus,
  ClearingLiquidityPool,
  ClearingLiquidityPoolRow,
  CrossBorderClearingBatch,
  CrossBorderClearingBatchRow,
} from '@/seed/types/multi-asset-clearing';
import {
  rowToClearingLiquidityPool,
  rowToCrossBorderClearingBatch,
} from '@/seed/types/multi-asset-clearing';

export async function listLiquidityPools(db: D1Database): Promise<ClearingLiquidityPool[]> {
  const result = await db
    .prepare('SELECT * FROM clearing_liquidity_pools ORDER BY asset_symbol ASC')
    .all<ClearingLiquidityPoolRow>();

  return (result.results ?? []).map(rowToClearingLiquidityPool);
}

export async function getLiquidityPoolByAsset(
  db: D1Database,
  asset: ClearingAsset
): Promise<ClearingLiquidityPool | null> {
  const row = await db
    .prepare("SELECT * FROM clearing_liquidity_pools WHERE asset_symbol = ? AND status = 'active'")
    .bind(asset)
    .first<ClearingLiquidityPoolRow>();

  return row ? rowToClearingLiquidityPool(row) : null;
}

export async function getClearingBatchByRef(
  db: D1Database,
  batchReference: string
): Promise<CrossBorderClearingBatch | null> {
  const row = await db
    .prepare('SELECT * FROM cross_border_clearing_batches WHERE batch_reference = ?')
    .bind(batchReference)
    .first<CrossBorderClearingBatchRow>();

  return row ? rowToCrossBorderClearingBatch(row) : null;
}

export async function listClearingBatches(
  db: D1Database,
  options?: { status?: ClearingBatchStatus; limit?: number }
): Promise<CrossBorderClearingBatch[]> {
  const limit = options?.limit ?? 50;
  if (options?.status) {
    const result = await db
      .prepare('SELECT * FROM cross_border_clearing_batches WHERE status = ? ORDER BY created_at DESC LIMIT ?')
      .bind(options.status, limit)
      .all<CrossBorderClearingBatchRow>();
    return (result.results ?? []).map(rowToCrossBorderClearingBatch);
  }

  const result = await db
    .prepare('SELECT * FROM cross_border_clearing_batches ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<CrossBorderClearingBatchRow>();

  return (result.results ?? []).map(rowToCrossBorderClearingBatch);
}
