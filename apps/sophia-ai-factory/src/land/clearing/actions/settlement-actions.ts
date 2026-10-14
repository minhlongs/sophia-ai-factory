'use server';

/**
 * Server Actions: Cross-Border Settlement, Liquidity Pools & Batch Reconciliation
 * @module land/clearing/actions/settlement-actions
 */

import type {
  ClearingLiquidityPool,
  CrossBorderClearingBatch,
  SwapQuoteInput,
  SwapQuoteResult,
  ExecuteClearingBatchInput,
  ClearingExecutionResult,
  ReconcileBatchInput,
  ReconciliationResult,
  ClearingActionError,
  ClearingBatchStatus,
} from '@/seed/types/multi-asset-clearing';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  listLiquidityPools,
  getLiquidityPoolByAsset,
  calculateSwapQuote,
  executeRtgsBatch,
  reconcileBatchWithBankStatement,
  executePoolRebalance,
  listClearingBatches,
} from '@/tree/clearing/multi-asset-clearing-engine';
import { getRequiredD1 } from './common';
import { runAuthenticatedSettlementAction } from './settlement-action-helpers';

/**
 * 1. Get Clearing Liquidity Pools Action
 * Returns all active reserve pools (USDT, USDC, EUR, JPY, SGD, VND).
 */
export async function getClearingLiquidityPoolsAction(): Promise<
  Result<ClearingLiquidityPool[], ClearingActionError>
> {
  return runAuthenticatedSettlementAction({
    errorCode: 'GET_POOLS_FAILED',
    logLabel: 'Failed to get clearing liquidity pools',
    handler: async (db) => success(await listLiquidityPools(db)),
  });
}

/**
 * 2. Quote Clearing Swap Action
 * Evaluates AMM pricing curve and verifies slippage < 0.05% (5 bps).
 */
export async function quoteClearingSwapAction(
  input: SwapQuoteInput,
): Promise<Result<SwapQuoteResult, ClearingActionError>> {
  try {
    const db = await getRequiredD1();
    const pool = await getLiquidityPoolByAsset(db, input.targetAsset);

    if (!pool) {
      return failure({
        code: 'TARGET_POOL_NOT_FOUND',
        message: `No active liquidity pool found for target asset ${input.targetAsset}`,
      });
    }

    return success(calculateSwapQuote(pool, input));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to calculate swap quote', { error: message, input });
    return failure({ code: 'QUOTE_SWAP_FAILED', message });
  }
}

/**
 * 3. Execute Cross-Border Clearing Action
 * Executes T+0 Real-Time Gross Settlement (RTGS) batch with strict slippage verification.
 */
export async function executeCrossBorderClearingAction(
  input: ExecuteClearingBatchInput,
): Promise<Result<ClearingExecutionResult, ClearingActionError>> {
  return runAuthenticatedSettlementAction({
    errorCode: 'EXECUTE_CLEARING_FAILED',
    logLabel: 'Failed to execute cross-border clearing batch',
    context: { input },
    handler: async (db) => {
      const result = await executeRtgsBatch(db, input);
      if (!result.success) {
        return failure({
          code: 'CLEARING_EXECUTION_REJECTED',
          message: result.error ?? 'Clearing batch execution was rejected',
        });
      }
      return success(result);
    },
  });
}

/**
 * 4. Reconcile Clearing Batch Action
 * Ingests external bank statement reference and reconciles internal batch.
 */
export async function reconcileClearingBatchAction(
  input: ReconcileBatchInput,
): Promise<Result<ReconciliationResult, ClearingActionError>> {
  return runAuthenticatedSettlementAction({
    errorCode: 'RECONCILE_BATCH_FAILED',
    logLabel: 'Failed to reconcile clearing batch',
    context: { input },
    handler: async (db) => {
      const result = await reconcileBatchWithBankStatement(db, input);
      if (!result.success) {
        return failure({
          code: 'RECONCILIATION_MISMATCH',
          message: result.error ?? 'Statement reconciliation mismatch',
        });
      }
      return success(result);
    },
  });
}

/**
 * 7. Trigger Pool Rebalance Action
 * Rebalances reserve liquidity from a surplus pool to a target pool.
 */
export async function triggerPoolRebalanceAction(input: {
  sourcePoolId: string;
  targetPoolId: string;
  amount: number;
}): Promise<Result<{ success: boolean; rebalancedAmount: number }, ClearingActionError>> {
  return runAuthenticatedSettlementAction({
    errorCode: 'TRIGGER_REBALANCE_FAILED',
    logLabel: 'Failed to trigger pool rebalance',
    context: { input },
    handler: async (db) => {
      const result = await executePoolRebalance(db, input.sourcePoolId, input.targetPoolId, input.amount);
      if (!result.success) {
        return failure({
          code: 'POOL_REBALANCE_FAILED',
          message: result.error ?? 'Pool rebalance failed',
        });
      }
      return success(result);
    },
  });
}

/**
 * 8. Get Clearing Batches Action
 * Lists clearing batches with optional status filtering.
 */
export async function getClearingBatchesAction(options?: {
  status?: ClearingBatchStatus;
  limit?: number;
}): Promise<Result<CrossBorderClearingBatch[], ClearingActionError>> {
  return runAuthenticatedSettlementAction({
    errorCode: 'GET_BATCHES_FAILED',
    logLabel: 'Failed to get clearing batches',
    context: { options },
    handler: async (db) => success(await listClearingBatches(db, options)),
  });
}
