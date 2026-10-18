/**
 * Batch & Swap Execution Helpers for Cross-Border Settlement Actions
 * @module land/clearing/actions/settlement-batch-helpers
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwapQuoteInput,
  SwapQuoteResult,
  ExecuteClearingBatchInput,
  ClearingExecutionResult,
  ReconcileBatchInput,
  ReconciliationResult,
  ClearingActionError,
} from '@/seed/types/multi-asset-clearing';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getLiquidityPoolByAsset,
  calculateSwapQuote,
  executeRtgsBatch,
  reconcileBatchWithBankStatement,
  executePoolRebalance,
} from '@/tree/clearing/multi-asset-clearing-engine';
import { getRequiredD1 } from './common';

export async function handleQuoteClearingSwap(
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

export async function handleExecuteCrossBorderClearing(
  db: D1Database,
  input: ExecuteClearingBatchInput,
): Promise<Result<ClearingExecutionResult, ClearingActionError>> {
  const result = await executeRtgsBatch(db, input);
  if (!result.success) {
    return failure({
      code: 'CLEARING_EXECUTION_REJECTED',
      message: result.error ?? 'Clearing batch execution was rejected',
    });
  }
  return success(result);
}

export async function handleReconcileClearingBatch(
  db: D1Database,
  input: ReconcileBatchInput,
): Promise<Result<ReconciliationResult, ClearingActionError>> {
  const result = await reconcileBatchWithBankStatement(db, input);
  if (!result.success) {
    return failure({
      code: 'RECONCILIATION_MISMATCH',
      message: result.error ?? 'Statement reconciliation mismatch',
    });
  }
  return success(result);
}

export async function handleTriggerPoolRebalance(
  db: D1Database,
  input: { sourcePoolId: string; targetPoolId: string; amount: number },
): Promise<Result<{ success: boolean; rebalancedAmount: number }, ClearingActionError>> {
  const result = await executePoolRebalance(
    db,
    input.sourcePoolId,
    input.targetPoolId,
    input.amount,
  );
  if (!result.success) {
    return failure({
      code: 'POOL_REBALANCE_FAILED',
      message: result.error ?? 'Pool rebalance failed',
    });
  }
  return success(result);
}
