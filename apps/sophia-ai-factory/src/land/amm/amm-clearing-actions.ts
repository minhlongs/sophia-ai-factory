/**
 * amm-clearing-actions.ts — Gate 11 Concentrated Liquidity AMM Server Actions
 * Layer: LAND (Server Actions / Controllers)
 *
 * Provides authenticated server actions for querying AMM swap quotes,
 * executing slippage-capped swaps with anti-sandwich protection,
 * and triggering multi-sig approved treasury rebalancing.
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  type AmmLiquidityPool,
  type AmmSwapTransaction,
  type AmmSwapQuoteRequest,
  type AmmSwapQuoteResult,
  type TreasuryRebalanceEvent,
} from '@/seed/types/amm-clearing';
import { ConcentratedLiquidityEngine } from '@/tree/amm/concentrated-liquidity-engine';
import { TreasuryRebalancer, type RebalanceEvaluationResult } from '@/tree/amm/treasury-rebalancer';

export interface AmmActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Calculates a real-time AMM swap quote.
 */
export async function getSwapQuoteAction(
  request: AmmSwapQuoteRequest
): Promise<AmmActionResponse<AmmSwapQuoteResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding not available' };
    }

    const pool = await ConcentratedLiquidityEngine.getPoolById(db, request.poolId);
    if (!pool) {
      return { success: false, error: `Pool not found: ${request.poolId}` };
    }

    const quote = ConcentratedLiquidityEngine.calculateSwapQuote(pool, request);
    return { success: true, data: quote };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate swap quote';
    logger.error('getSwapQuoteAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Executes a verified AMM swap transaction with anti-sandwich MEV protection.
 */
export async function executeAmmSwapAction(
  request: AmmSwapQuoteRequest,
  recipientAddress: string,
  antiSandwichNonce: number
): Promise<AmmActionResponse<AmmSwapTransaction>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding not available' };
    }

    const pool = await ConcentratedLiquidityEngine.getPoolById(db, request.poolId);
    if (!pool) {
      return { success: false, error: `Pool not found: ${request.poolId}` };
    }

    const { transaction, updatedPool } = ConcentratedLiquidityEngine.executeSwap(
      pool,
      request,
      recipientAddress,
      antiSandwichNonce
    );

    if (transaction.executionStatus === 'EXECUTED') {
      await ConcentratedLiquidityEngine.persistPool(db, updatedPool);
    }

    return { success: true, data: transaction };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to execute swap transaction';
    logger.error('executeAmmSwapAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Evaluates whether an AMM liquidity pool requires treasury rebalancing.
 */
export async function evaluateRebalanceAction(
  poolId: string,
  targetRatio = 1.0
): Promise<AmmActionResponse<RebalanceEvaluationResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding not available' };
    }

    const pool = await ConcentratedLiquidityEngine.getPoolById(db, poolId);
    if (!pool) {
      return { success: false, error: `Pool not found: ${poolId}` };
    }

    const evalResult = TreasuryRebalancer.evaluatePoolDeviation(pool, targetRatio);
    return { success: true, data: evalResult };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to evaluate rebalance';
    logger.error('evaluateRebalanceAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Dispatches an authorized multi-sig treasury rebalance event.
 */
export async function executeRebalanceAction(
  sourcePoolId: string,
  targetPoolId: string,
  currencyMoved: string,
  amountUnits: string,
  operatorKeys: string[]
): Promise<AmmActionResponse<TreasuryRebalanceEvent>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding not available' };
    }

    const sourcePool = await ConcentratedLiquidityEngine.getPoolById(db, sourcePoolId);
    const targetPool = await ConcentratedLiquidityEngine.getPoolById(db, targetPoolId);

    if (!sourcePool || !targetPool) {
      return { success: false, error: 'Source or target pool not found' };
    }

    const { event, rebalancedSourcePool } = TreasuryRebalancer.executeRebalance(
      sourcePool,
      targetPool,
      currencyMoved,
      amountUnits,
      operatorKeys
    );

    if (event.status === 'SETTLED') {
      await ConcentratedLiquidityEngine.persistPool(db, rebalancedSourcePool);
      await TreasuryRebalancer.recordRebalanceEvent(db, event);
    }

    return { success: true, data: event };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to execute rebalance';
    logger.error('executeRebalanceAction failed', { error: message });
    return { success: false, error: message };
  }
}
