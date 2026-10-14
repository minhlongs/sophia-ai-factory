/**
 * Concentrated Liquidity AMM Engine Facade Class
 * Layer: TREE (Business Logic)
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AmmLiquidityPool,
  AmmSwapQuoteRequest,
  AmmSwapQuoteResult,
  ExecuteSwapResult,
} from './types';
import { calculateSwapQuote } from './quote-calculator';
import { executeSwap } from './swap-executor';
import { persistPool, getPoolById } from './pool-repository';

export class ConcentratedLiquidityEngine {
  /**
   * Calculates a swap quote given an AMM pool and input parameters.
   * Enforces institutional slippage cap (default ≤ 3 bps).
   */
  public static calculateSwapQuote(
    pool: AmmLiquidityPool,
    request: AmmSwapQuoteRequest
  ): AmmSwapQuoteResult {
    return calculateSwapQuote(pool, request);
  }

  /**
   * Executes a verified swap transaction with anti-sandwich MEV protection proof.
   */
  public static executeSwap(
    pool: AmmLiquidityPool,
    request: AmmSwapQuoteRequest,
    recipientAddress: string,
    antiSandwichNonce: number
  ): ExecuteSwapResult {
    return executeSwap(pool, request, recipientAddress, antiSandwichNonce);
  }

  /**
   * Persists an AMM liquidity pool into Cloudflare D1.
   */
  public static async persistPool(db: D1Database, pool: AmmLiquidityPool): Promise<void> {
    return persistPool(db, pool);
  }

  /**
   * Retrieves an AMM pool by ID from Cloudflare D1.
   */
  public static async getPoolById(
    db: D1Database,
    poolId: string
  ): Promise<AmmLiquidityPool | null> {
    return getPoolById(db, poolId);
  }
}
