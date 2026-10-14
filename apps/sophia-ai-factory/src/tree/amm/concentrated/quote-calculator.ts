/**
 * Concentrated Liquidity Swap Quote Calculator
 * Layer: TREE (Business Logic)
 */

import {
  AMM_CONSTANTS,
  type AmmLiquidityPool,
  type AmmSwapQuoteRequest,
  type AmmSwapQuoteResult,
} from './types';

function createRejectedQuote(
  poolId: string,
  amountInUnits: string,
  rejectReason: string
): AmmSwapQuoteResult {
  return {
    poolId,
    amountInUnits,
    expectedAmountOutUnits: '0',
    minAmountOutUnits: '0',
    estimatedSlippageBps: 0,
    feeUnits: '0',
    feeUsdCents: 0,
    effectivePriceRatio: 0,
    isApproved: false,
    rejectReason,
  };
}

export function calculateSwapQuote(
  pool: AmmLiquidityPool,
  request: AmmSwapQuoteRequest
): AmmSwapQuoteResult {
  if (pool.isCircuitBreakerTripped) {
    return createRejectedQuote(pool.id, request.amountInUnits, 'Circuit breaker is tripped — trading halted on this pair');
  }

  const amountIn = Number(request.amountInUnits);
  if (isNaN(amountIn) || amountIn <= 0) {
    return createRejectedQuote(pool.id, request.amountInUnits, 'Invalid swap amount');
  }

  const isToken0In = request.tokenInSymbol === pool.token0Symbol;
  const reserveIn = Number(isToken0In ? pool.reserve0AmountUnits : pool.reserve1AmountUnits);
  const reserveOut = Number(isToken0In ? pool.reserve1AmountUnits : pool.reserve0AmountUnits);

  if (reserveIn <= 0 || reserveOut <= 0) {
    return createRejectedQuote(pool.id, request.amountInUnits, 'Pool reserves depleted');
  }

  const feeBps = pool.feeTierBps || AMM_CONSTANTS.DEFAULT_FEE_TIER_BPS;
  const feeAmount = (amountIn * feeBps) / 10_000;
  const effectiveAmountIn = amountIn - feeAmount;

  const amountOut = (reserveOut * effectiveAmountIn) / (reserveIn + effectiveAmountIn);
  const marginalPrice = reserveOut / reserveIn;
  const effectiveExecutionPrice = effectiveAmountIn > 0 ? amountOut / effectiveAmountIn : 0;
  const executionPrice = amountIn > 0 ? amountOut / amountIn : 0;

  const slippageBps = Math.max(0, Math.round(((marginalPrice - effectiveExecutionPrice) / marginalPrice) * 10_000));
  const maxAllowedSlippage = request.maxAcceptableSlippageBps !== undefined
    ? request.maxAcceptableSlippageBps
    : pool.maxSlippageCapBps || AMM_CONSTANTS.MAX_INSTITUTIONAL_SLIPPAGE_BPS;

  const isSlippageAcceptable = slippageBps <= maxAllowedSlippage;
  const minAmountOut = Math.floor(amountOut * (1 - maxAllowedSlippage / 10_000));
  const feeUsdCents = Math.max(1, Math.floor((feeAmount / 1_000_000) * 100));

  return {
    poolId: pool.id,
    amountInUnits: request.amountInUnits,
    expectedAmountOutUnits: Math.floor(amountOut).toString(),
    minAmountOutUnits: minAmountOut.toString(),
    estimatedSlippageBps: slippageBps,
    feeUnits: Math.floor(feeAmount).toString(),
    feeUsdCents,
    effectivePriceRatio: Number(executionPrice.toFixed(6)),
    isApproved: isSlippageAcceptable,
    rejectReason: isSlippageAcceptable
      ? undefined
      : `Slippage ${slippageBps} bps exceeds maximum threshold of ${maxAllowedSlippage} bps`,
  };
}
