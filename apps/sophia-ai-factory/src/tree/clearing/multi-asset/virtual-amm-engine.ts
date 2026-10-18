/**
 * Multi-Asset Virtual AMM Pricing & Reserve Pool Rebalancing Engine
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/virtual-amm-engine
 */

import type {
  ClearingLiquidityPool,
  SwapQuoteInput,
  SwapQuoteResult,
} from '@/seed/types/multi-asset-clearing';
import { MAX_SLIPPAGE_TOLERANCE_PCT } from '@/seed/types/multi-asset-clearing';
import {
  getSpotExchangeRate,
  normalizeAssetAmount,
} from './currency-precision';

export { needsRebalance, executePoolRebalance } from './pool-rebalancer';

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
