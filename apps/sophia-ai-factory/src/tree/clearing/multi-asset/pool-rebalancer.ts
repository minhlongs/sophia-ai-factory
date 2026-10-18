/**
 * Multi-Asset Liquidity Pool Drift & Automated Rebalance Executor
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/pool-rebalancer
 */

import type { D1Database } from '@/seed/db/client';
import {
  type ClearingLiquidityPool,
  type ClearingLiquidityPoolRow,
  rowToClearingLiquidityPool,
} from '@/seed/types/multi-asset-clearing';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Checks whether a liquidity pool has drifted beyond its rebalance threshold (default 15%).
 */
export function needsRebalance(pool: ClearingLiquidityPool): boolean {
  if (pool.targetReserveAmount <= 0) return false;
  const driftRatio = Math.abs(pool.availableReserveAmount - pool.targetReserveAmount) / pool.targetReserveAmount;
  return (driftRatio * 100) >= pool.rebalanceThresholdPct;
}

/**
 * Executes an automated liquidity pool rebalance between a surplus pool and a target pool.
 */
export async function executePoolRebalance(
  db: D1Database,
  sourcePoolId: string,
  targetPoolId: string,
  amount: number
): Promise<{ success: boolean; rebalancedAmount: number; error?: string }> {
  const now = Date.now();
  const sourceRow = await db
    .prepare('SELECT * FROM clearing_liquidity_pools WHERE id = ?')
    .bind(sourcePoolId)
    .first<ClearingLiquidityPoolRow>();

  const targetRow = await db
    .prepare('SELECT * FROM clearing_liquidity_pools WHERE id = ?')
    .bind(targetPoolId)
    .first<ClearingLiquidityPoolRow>();

  if (!sourceRow || !targetRow) {
    return { success: false, rebalancedAmount: 0, error: 'POOL_NOT_FOUND' };
  }

  const sourcePool = rowToClearingLiquidityPool(sourceRow);
  if (sourcePool.availableReserveAmount < amount) {
    return { success: false, rebalancedAmount: 0, error: 'INSUFFICIENT_SOURCE_LIQUIDITY' };
  }

  await db
    .prepare(
      `UPDATE clearing_liquidity_pools
       SET available_reserve_amount = available_reserve_amount - ?,
           last_rebalanced_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(amount, now, now, sourcePoolId)
    .run();

  await db
    .prepare(
      `UPDATE clearing_liquidity_pools
       SET available_reserve_amount = available_reserve_amount + ?,
           last_rebalanced_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(amount, now, now, targetPoolId)
    .run();

  logger.info('Pool rebalance completed successfully', {
    sourcePoolId,
    targetPoolId,
    amount,
  });

  return { success: true, rebalancedAmount: amount };
}
