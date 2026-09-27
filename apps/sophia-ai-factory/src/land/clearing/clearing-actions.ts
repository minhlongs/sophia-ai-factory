'use server';

/**
 * Server Actions: Cross-Border Multi-Asset Clearing & Swarm v2 Telemetry Operations
 *
 * Layer: land/clearing (Next.js 15 Server Actions, auth verification, D1 persistence dispatch)
 * Dependencies:
 *   - @/seed/auth/better-auth-session
 *   - @/seed/db/client
 *   - @/seed/types/multi-asset-clearing
 *   - @/seed/types/result
 *   - @/seed/utils/logger-utility
 *   - @/tree/clearing/multi-asset-clearing-engine
 *   - @/tree/swarm/swarm-v2-mesh-coordinator
 *
 * Rules:
 * - NO imports from @/forest or @/land
 * - NO :any types
 * - Strict auth enforcement via getCurrentUser()
 *
 * @module land/clearing/clearing-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import type {
  ClearingLiquidityPool,
  CrossBorderClearingBatch,
  SwarmV2ConsensusState,
  SwapQuoteInput,
  SwapQuoteResult,
  ExecuteClearingBatchInput,
  ClearingExecutionResult,
  ReconcileBatchInput,
  ReconciliationResult,
  HeartbeatTelemetryV2Input,
  ConsensusTelemetryResult,
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
import {
  getSwarmV2State,
  updateSwarmV2Heartbeat,
} from '@/tree/swarm/swarm-v2-mesh-coordinator';

/**
 * Ensures caller is an authenticated user session.
 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: You must be signed in to perform clearing operations.');
  }
  return user;
}

/**
 * Resolves active D1 database or throws typed error.
 */
async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database binding is unavailable.');
  }
  return db;
}

/**
 * 1. Get Clearing Liquidity Pools Action
 * Returns all active reserve pools (USDT, USDC, EUR, JPY, SGD, VND).
 */
export async function getClearingLiquidityPoolsAction(): Promise<
  Result<ClearingLiquidityPool[], ClearingActionError>
> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const pools = await listLiquidityPools(db);
    return success(pools);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to get clearing liquidity pools', { error: message });
    return failure({
      code: 'GET_POOLS_FAILED',
      message,
    });
  }
}

/**
 * 2. Quote Clearing Swap Action
 * Evaluates AMM pricing curve and verifies slippage < 0.05% (5 bps).
 */
export async function quoteClearingSwapAction(
  input: SwapQuoteInput
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

    const quote = calculateSwapQuote(pool, input);
    return success(quote);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to calculate swap quote', { error: message, input });
    return failure({
      code: 'QUOTE_SWAP_FAILED',
      message,
    });
  }
}

/**
 * 3. Execute Cross-Border Clearing Action
 * Executes T+0 Real-Time Gross Settlement (RTGS) batch with strict slippage verification.
 */
export async function executeCrossBorderClearingAction(
  input: ExecuteClearingBatchInput
): Promise<Result<ClearingExecutionResult, ClearingActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const result = await executeRtgsBatch(db, input);

    if (!result.success) {
      return failure({
        code: 'CLEARING_EXECUTION_REJECTED',
        message: result.error ?? 'Clearing batch execution was rejected',
      });
    }

    return success(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to execute cross-border clearing batch', { error: message, input });
    return failure({
      code: 'EXECUTE_CLEARING_FAILED',
      message,
    });
  }
}

/**
 * 4. Reconcile Clearing Batch Action
 * Ingests external bank statement reference and reconciles internal batch.
 */
export async function reconcileClearingBatchAction(
  input: ReconcileBatchInput
): Promise<Result<ReconciliationResult, ClearingActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const result = await reconcileBatchWithBankStatement(db, input);

    if (!result.success) {
      return failure({
        code: 'RECONCILIATION_MISMATCH',
        message: result.error ?? 'Statement reconciliation mismatch',
      });
    }

    return success(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to reconcile clearing batch', { error: message, input });
    return failure({
      code: 'RECONCILE_BATCH_FAILED',
      message,
    });
  }
}

/**
 * 5. Get Swarm v2 Consensus State Action
 * Returns active Raft-BFT cluster topology and sub-10ms latency metrics.
 */
export async function getSwarmV2ConsensusStateAction(): Promise<
  Result<SwarmV2ConsensusState, ClearingActionError>
> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const state = await getSwarmV2State(db);

    if (!state) {
      return failure({
        code: 'CONSENSUS_STATE_NOT_INITIALIZED',
        message: 'Swarm v2 consensus state has not been initialized in D1.',
      });
    }

    return success(state);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to get Swarm v2 consensus state', { error: message });
    return failure({
      code: 'GET_CONSENSUS_STATE_FAILED',
      message,
    });
  }
}

/**
 * 6. Record Swarm v2 Heartbeat Action
 * Ingests node ping and updates EMA latency.
 */
export async function recordSwarmV2HeartbeatAction(
  input: HeartbeatTelemetryV2Input
): Promise<Result<ConsensusTelemetryResult, ClearingActionError>> {
  try {
    const db = await getRequiredD1();
    const result = await updateSwarmV2Heartbeat(db, input);
    return success(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to record Swarm v2 heartbeat', { error: message, input });
    return failure({
      code: 'RECORD_HEARTBEAT_FAILED',
      message,
    });
  }
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
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const result = await executePoolRebalance(db, input.sourcePoolId, input.targetPoolId, input.amount);

    if (!result.success) {
      return failure({
        code: 'POOL_REBALANCE_FAILED',
        message: result.error ?? 'Pool rebalance failed',
      });
    }

    return success(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to trigger pool rebalance', { error: message, input });
    return failure({
      code: 'TRIGGER_REBALANCE_FAILED',
      message,
    });
  }
}

/**
 * 8. Get Clearing Batches Action
 * Lists clearing batches with optional status filtering.
 */
export async function getClearingBatchesAction(options?: {
  status?: ClearingBatchStatus;
  limit?: number;
}): Promise<Result<CrossBorderClearingBatch[], ClearingActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const batches = await listClearingBatches(db, options);
    return success(batches);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to get clearing batches', { error: message, options });
    return failure({
      code: 'GET_BATCHES_FAILED',
      message,
    });
  }
}
