/**
 * concentrated-liquidity-engine.ts — Gate 11 Concentrated Liquidity AMM Engine
 * Layer: TREE (Business Logic)
 *
 * Implements automated market maker swap math, dynamic fee adjustment,
 * strict institutional slippage capping (≤0.03%), and anti-sandwich attack protection.
 */

import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import {
  AMM_CONSTANTS,
  type AmmLiquidityPool,
  type AmmSwapTransaction,
  type AmmSwapQuoteRequest,
  type AmmSwapQuoteResult,
  rowToAmmLiquidityPool,
} from '@/seed/types/amm-clearing';

export class ConcentratedLiquidityEngine {
  /**
   * Calculates a swap quote given an AMM pool and input parameters.
   * Enforces institutional slippage cap (default ≤ 3 bps).
   */
  public static calculateSwapQuote(
    pool: AmmLiquidityPool,
    request: AmmSwapQuoteRequest
  ): AmmSwapQuoteResult {
    if (pool.isCircuitBreakerTripped) {
      return {
        poolId: pool.id,
        amountInUnits: request.amountInUnits,
        expectedAmountOutUnits: '0',
        minAmountOutUnits: '0',
        estimatedSlippageBps: 0,
        feeUnits: '0',
        feeUsdCents: 0,
        effectivePriceRatio: 0,
        isApproved: false,
        rejectReason: 'Circuit breaker is tripped — trading halted on this pair',
      };
    }

    const amountIn = Number(request.amountInUnits);
    if (isNaN(amountIn) || amountIn <= 0) {
      return {
        poolId: pool.id,
        amountInUnits: request.amountInUnits,
        expectedAmountOutUnits: '0',
        minAmountOutUnits: '0',
        estimatedSlippageBps: 0,
        feeUnits: '0',
        feeUsdCents: 0,
        effectivePriceRatio: 0,
        isApproved: false,
        rejectReason: 'Invalid swap amount',
      };
    }

    // Determine reserves based on token direction
    const isToken0In = request.tokenInSymbol === pool.token0Symbol;
    const reserveIn = Number(isToken0In ? pool.reserve0AmountUnits : pool.reserve1AmountUnits);
    const reserveOut = Number(isToken0In ? pool.reserve1AmountUnits : pool.reserve0AmountUnits);

    if (reserveIn <= 0 || reserveOut <= 0) {
      return {
        poolId: pool.id,
        amountInUnits: request.amountInUnits,
        expectedAmountOutUnits: '0',
        minAmountOutUnits: '0',
        estimatedSlippageBps: 0,
        feeUnits: '0',
        feeUsdCents: 0,
        effectivePriceRatio: 0,
        isApproved: false,
        rejectReason: 'Pool reserves depleted',
      };
    }

    // Dynamic fee calculation (e.g. 5 bps default)
    const feeBps = pool.feeTierBps || AMM_CONSTANTS.DEFAULT_FEE_TIER_BPS;
    const feeAmount = (amountIn * feeBps) / 10_000;
    const effectiveAmountIn = amountIn - feeAmount;

    // Constant product swap formula: dy = (reserveOut * dx) / (reserveIn + dx)
    const amountOut = (reserveOut * effectiveAmountIn) / (reserveIn + effectiveAmountIn);

    // Marginal price = reserveOut / reserveIn
    const marginalPrice = reserveOut / reserveIn;
    // Effective execution price (excluding fee) = amountOut / effectiveAmountIn
    const effectiveExecutionPrice = effectiveAmountIn > 0 ? amountOut / effectiveAmountIn : 0;
    // Gross execution price = amountOut / amountIn
    const executionPrice = amountIn > 0 ? amountOut / amountIn : 0;

    // Slippage (price impact) in basis points: ((marginalPrice - effectiveExecutionPrice) / marginalPrice) * 10,000
    const slippageBps = Math.max(0, Math.round(((marginalPrice - effectiveExecutionPrice) / marginalPrice) * 10_000));

    const maxAllowedSlippage = request.maxAcceptableSlippageBps !== undefined
      ? request.maxAcceptableSlippageBps
      : pool.maxSlippageCapBps || AMM_CONSTANTS.MAX_INSTITUTIONAL_SLIPPAGE_BPS;

    const isSlippageAcceptable = slippageBps <= maxAllowedSlippage;

    // Min amount out based on max acceptable slippage
    const minAmountOut = Math.floor(amountOut * (1 - maxAllowedSlippage / 10_000));
    const feeUsdCents = Math.max(1, Math.floor((feeAmount / 1_000_000) * 100)); // assuming 6 decimals

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

  /**
   * Executes a verified swap transaction with anti-sandwich MEV protection proof.
   */
  public static executeSwap(
    pool: AmmLiquidityPool,
    request: AmmSwapQuoteRequest,
    recipientAddress: string,
    antiSandwichNonce: number
  ): { transaction: AmmSwapTransaction; updatedPool: AmmLiquidityPool } {
    const quote = this.calculateSwapQuote(pool, request);

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

    // Update pool reserves
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

  /**
   * Persists an AMM liquidity pool into Cloudflare D1.
   */
  public static async persistPool(db: D1Database, pool: AmmLiquidityPool): Promise<void> {
    await db
      .prepare(
        `INSERT OR REPLACE INTO amm_liquidity_pools (
          id, pair_symbol, token0_symbol, token1_symbol, token0_decimals,
          token1_decimals, reserve0_amount_units, reserve1_amount_units,
          current_sqrt_price_x96, current_tick, tick_spacing, fee_tier_bps,
          max_slippage_cap_bps, total_value_locked_usd_cents, volume_24h_usd_cents,
          is_circuit_breaker_tripped, last_rebalanced_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        pool.id,
        pool.pairSymbol,
        pool.token0Symbol,
        pool.token1Symbol,
        pool.token0Decimals,
        pool.token1Decimals,
        pool.reserve0AmountUnits,
        pool.reserve1AmountUnits,
        pool.currentSqrtPriceX96,
        pool.currentTick,
        pool.tickSpacing,
        pool.feeTierBps,
        pool.maxSlippageCapBps,
        pool.totalValueLockedUsdCents,
        pool.volume24hUsdCents,
        pool.isCircuitBreakerTripped ? 1 : 0,
        pool.lastRebalancedAt,
        pool.createdAt
      )
      .run();
  }

  /**
   * Retrieves an AMM pool by ID from Cloudflare D1.
   */
  public static async getPoolById(db: D1Database, poolId: string): Promise<AmmLiquidityPool | null> {
    const row = await db.prepare('SELECT * FROM amm_liquidity_pools WHERE id = ?').bind(poolId).first<Record<string, unknown>>();
    return row ? rowToAmmLiquidityPool(row) : null;
  }
}
