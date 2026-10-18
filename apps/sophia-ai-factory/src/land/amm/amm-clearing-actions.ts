/**
 * amm-clearing-actions.ts — Gate 11 Concentrated Liquidity AMM Server Actions
 * Layer: LAND (Server Actions / Controllers)
 *
 * Provides authenticated server actions for querying AMM swap quotes,
 * executing slippage-capped swaps with anti-sandwich protection,
 * and triggering multi-sig approved treasury rebalancing.
 */

'use server';

import { logger } from '@/seed/utils/logger-utility';
import type {
  AmmSwapTransaction,
  AmmSwapQuoteRequest,
  AmmSwapQuoteResult,
  TreasuryRebalanceEvent,
} from '@/seed/types/amm-clearing';
import { ConcentratedLiquidityEngine } from '@/tree/amm/concentrated-liquidity-engine';
import { TreasuryRebalancer, type RebalanceEvaluationResult } from '@/tree/amm/treasury-rebalancer';
import {
  resolveAuthenticatedAmmPool,
  runAuthenticatedRebalance,
  type AmmActionResponse,
} from './amm-clearing-helpers';

export type { AmmActionResponse } from './amm-clearing-helpers';

/**
 * Calculates a real-time AMM swap quote.
 */
export async function getSwapQuoteAction(
  request: AmmSwapQuoteRequest,
): Promise<AmmActionResponse<AmmSwapQuoteResult>> {
  try {
    const resolved = await resolveAuthenticatedAmmPool(request.poolId);
    if (!resolved.ok) return { success: false, error: resolved.error };

    const quote = ConcentratedLiquidityEngine.calculateSwapQuote(resolved.pool, request);
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
  antiSandwichNonce: number,
): Promise<AmmActionResponse<AmmSwapTransaction>> {
  try {
    const resolved = await resolveAuthenticatedAmmPool(request.poolId);
    if (!resolved.ok) return { success: false, error: resolved.error };

    const { transaction, updatedPool } = ConcentratedLiquidityEngine.executeSwap(
      resolved.pool,
      request,
      recipientAddress,
      antiSandwichNonce,
    );

    if (transaction.executionStatus === 'EXECUTED') {
      await ConcentratedLiquidityEngine.persistPool(resolved.db, updatedPool);
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
  targetRatio = 1.0,
): Promise<AmmActionResponse<RebalanceEvaluationResult>> {
  try {
    const resolved = await resolveAuthenticatedAmmPool(poolId);
    if (!resolved.ok) return { success: false, error: resolved.error };

    const evalResult = TreasuryRebalancer.evaluatePoolDeviation(resolved.pool, targetRatio);
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
  operatorKeys: string[],
): Promise<AmmActionResponse<TreasuryRebalanceEvent>> {
  try {
    return await runAuthenticatedRebalance(
      sourcePoolId,
      targetPoolId,
      currencyMoved,
      amountUnits,
      operatorKeys,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to execute rebalance';
    logger.error('executeRebalanceAction failed', { error: message });
    return { success: false, error: message };
  }
}
