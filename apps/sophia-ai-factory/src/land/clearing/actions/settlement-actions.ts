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
import { success, type Result } from '@/seed/types/result';
import {
  listLiquidityPools,
  listClearingBatches,
} from '@/tree/clearing/multi-asset-clearing-engine';
import { runAuthenticatedSettlementAction } from './settlement-action-helpers';
import {
  handleQuoteClearingSwap,
  handleExecuteCrossBorderClearing,
  handleReconcileClearingBatch,
  handleTriggerPoolRebalance,
} from './settlement-batch-helpers';

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
  return handleQuoteClearingSwap(input);
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
    handler: (db) => handleExecuteCrossBorderClearing(db, input),
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
    handler: (db) => handleReconcileClearingBatch(db, input),
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
    handler: (db) => handleTriggerPoolRebalance(db, input),
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
