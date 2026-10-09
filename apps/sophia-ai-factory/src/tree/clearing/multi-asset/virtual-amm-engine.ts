/**
 * Multi-Asset Virtual AMM Pricing & Reserve Pool Rebalancing Engine
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/virtual-amm-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClearingLiquidityPool,
  ClearingLiquidityPoolRow,
  SwapQuoteInput,
  SwapQuoteResult,
} from '@/seed/types/multi-asset-clearing';
import {
  MAX_SLIPPAGE_TOLERANCE_PCT,
  rowToClearingLiquidityPool,
} from '@/seed/types/multi-asset-clearing';
import { logger } from '@/seed/utils/logger-utility';
import {
  getSpotExchangeRate,
  normalizeAssetAmount,
} from './currency-precision';

/**
 * Calculates a swap quotation through a liquidity pool's virtual AMM curve.
 * Strictly verifies that slippage is less than the 0.05% threshold.
 */
export function calculateSwapQuote(
  pool: ClearingLiquidityPool,
  input: SwapQuoteInput
): SwapQuoteResult {
  const { sourceAsset, targetAsset, sourceAmount } = input;
  const maxAcceptableSlippage = input.maxAcceptableSlippagePct ?? MAX_SLIPPAGE_TOLERANCE_PCT;

  const marketRate = getSpotExchangeRate(sourceAsset, targetAsset);
  const nominalTargetAmount = sourceAmount * marketRate;

  if (
    pool.status !== 'active' ||
    pool.availableReserveAmount <= 0 ||
    nominalTargetAmount > pool.availableReserveAmount
  ) {
    return {
      sourceAsset,
      targetAsset,
      sourceAmount,
      targetAmount: 0,
      effectiveRate: 0,
      marketRate,
      slippagePct: 100.0,
      clearingFeeAmount: 0,
      slippageAcceptable: false,
      recommendedPoolId: pool.id,
      routeLegs: [],
    };
  }

  // Virtual AMM Slippage curve: nominalTarget / (2 * availableReserve + nominalTarget)
  const slippageRatio = nominalTargetAmount / (2 * pool.availableReserveAmount + nominalTargetAmount);
  const slippagePct = Math.round(slippageRatio * 1000000) / 10000;
  const isAcceptable = slippagePct <= maxAcceptableSlippage;

  const feeRate = pool.feeTierBps / 10000;
  const grossFee = nominalTargetAmount * feeRate;
  const clearingFeeAmount = normalizeAssetAmount(grossFee, targetAsset);

  const grossSlippedAmount = nominalTargetAmount * (1 - slippageRatio);
  const rawTargetAmount = Math.max(0, grossSlippedAmount - clearingFeeAmount);
  const targetAmount = normalizeAssetAmount(rawTargetAmount, targetAsset);

  const effectiveRate = sourceAmount > 0 ? targetAmount / sourceAmount : 0;

  return {
    sourceAsset,
    targetAsset,
    sourceAmount,
    targetAmount,
    effectiveRate,
    marketRate,
    slippagePct,
    clearingFeeAmount,
    slippageAcceptable: isAcceptable,
    recommendedPoolId: pool.id,
    routeLegs: [{ from: sourceAsset, to: targetAsset, rate: effectiveRate }],
  };
}

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
