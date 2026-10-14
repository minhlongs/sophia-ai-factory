/**
 * Concentrated Liquidity Swap Executor
 * Layer: TREE (Business Logic)
 */

import { createHash } from 'node:crypto';
import type {
  AmmLiquidityPool,
  AmmSwapQuoteRequest,
  AmmSwapTransaction,
  ExecuteSwapResult,
} from './types';
import { calculateSwapQuote } from './quote-calculator';

export function executeSwap(
  pool: AmmLiquidityPool,
  request: AmmSwapQuoteRequest,
  recipientAddress: string,
  antiSandwichNonce: number
): ExecuteSwapResult {
  const quote = calculateSwapQuote(pool, request);

  const isToken0In = request.tokenInSymbol === pool.token0Symbol;
  const tokenOutSymbol = isToken0In ? pool.token1Symbol : pool.token0Symbol;

  const mevPayload = `${pool.id}:${request.traderIdentifier}:${antiSandwichNonce}:${request.amountInUnits}:${quote.expectedAmountOutUnits}`;
  const mevProtectionProof = createHash('sha256').update(mevPayload).digest('hex');

  const transaction: AmmSwapTransaction = {
    id: `swap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    poolId: pool.id,
    traderIdentifier: request.traderIdentifier,
    recipientAddress,
    amountInUnits: request.amountInUnits,
    amountOutUnits: quote.expectedAmountOutUnits,
    tokenInSymbol: request.tokenInSymbol,
    tokenOutSymbol,
    effectivePriceRatio: quote.effectivePriceRatio,
    slippageExperiencedBps: quote.estimatedSlippageBps,
    feeCollectedCents: quote.feeUsdCents,
    antiSandwichNonce,
    mevProtectionProof,
    executionStatus: quote.isApproved ? 'EXECUTED' : 'SLIPPAGE_REJECTED',
    createdAt: new Date().toISOString(),
  };

  if (!quote.isApproved) {
    return { transaction, updatedPool: pool };
  }

  const inNum = Number(request.amountInUnits);
  const outNum = Number(quote.expectedAmountOutUnits);

  const newReserve0 = isToken0In
    ? (Number(pool.reserve0AmountUnits) + inNum).toString()
    : (Number(pool.reserve0AmountUnits) - outNum).toString();

  const newReserve1 = isToken0In
    ? (Number(pool.reserve1AmountUnits) - outNum).toString()
    : (Number(pool.reserve1AmountUnits) + inNum).toString();

  const updatedPool: AmmLiquidityPool = {
    ...pool,
    reserve0AmountUnits: newReserve0,
    reserve1AmountUnits: newReserve1,
    volume24hUsdCents: pool.volume24hUsdCents + quote.feeUsdCents * 2000,
  };

  return { transaction, updatedPool };
}
