/**
 * T+0 RTGS Settlement Pipeline & Merkle Proof Attestation
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/rtgs-settlement-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClearingExecutionResult,
  ClearingLiquidityPoolRow,
  ExecuteClearingBatchInput,
} from '@/seed/types/multi-asset-clearing';
import {
  MAX_SLIPPAGE_TOLERANCE_PCT,
  rowToClearingLiquidityPool,
} from '@/seed/types/multi-asset-clearing';
import { logger } from '@/seed/utils/logger-utility';
import {
  buildFailedResult,
  buildRtgsAttestation,
  persistClearedRtgsBatch,
} from './rtgs-batch-helpers';
import { calculateSwapQuote } from './virtual-amm-engine';

/**
 * Executes a T+0 Real-Time Gross Settlement (RTGS) batch.
 * Verifies liquidity, confirms strict slippage (< 0.05%), records Merkle attestation,
 * updates pool reserves, and persists batch record into D1.
 */
export async function executeRtgsBatch(
  db: D1Database,
  input: ExecuteClearingBatchInput,
): Promise<ClearingExecutionResult> {
  const { sourceAsset, targetAsset, grossAmount } = input;
  const settlementType = input.settlementType ?? 'T0_RTGS';

  const targetPoolRow = await db
    .prepare(
      `SELECT * FROM clearing_liquidity_pools
       WHERE asset_symbol = ? AND status = 'active'
       ORDER BY available_reserve_amount DESC LIMIT 1`,
    )
    .bind(targetAsset)
    .first<ClearingLiquidityPoolRow>();

  if (!targetPoolRow) {
    return buildFailedResult(input, settlementType, 'failed', `NO_ACTIVE_POOL_FOR_ASSET: ${targetAsset}`);
  }

  const pool = rowToClearingLiquidityPool(targetPoolRow);
  const quote = calculateSwapQuote(pool, {
    sourceAsset,
    targetAsset,
    sourceAmount: grossAmount,
    maxAcceptableSlippagePct: MAX_SLIPPAGE_TOLERANCE_PCT,
  });

  if (!quote.slippageAcceptable) {
    return buildFailedResult(
      input,
      settlementType,
      'rejected',
      `SLIPPAGE_EXCEEDED: Realized ${quote.slippagePct.toFixed(4)}% exceeds 0.05% tolerance cap`,
      quote.slippagePct,
    );
  }

  if (quote.targetAmount > pool.availableReserveAmount) {
    return buildFailedResult(input, settlementType, 'rejected', 'INSUFFICIENT_POOL_RESERVE', quote.slippagePct);
  }

  const attestation = await buildRtgsAttestation(input, quote.targetAmount);
  await persistClearedRtgsBatch(db, input, settlementType, pool.id, quote, attestation);

  logger.info('T+0 RTGS settlement batch cleared', {
    batchId: attestation.batchId,
    batchReference: attestation.batchReference,
    sourceAsset,
    targetAsset,
    grossAmount,
    netClearedAmount: quote.targetAmount,
    slippagePct: quote.slippagePct,
  });

  return {
    success: true,
    batchId: attestation.batchId,
    batchReference: attestation.batchReference,
    sourceAsset,
    targetAsset,
    grossAmount,
    netClearedAmount: quote.targetAmount,
    clearingFeeAmount: quote.clearingFeeAmount,
    slippageRealizedPct: quote.slippagePct,
    iso20022MessageId: attestation.iso20022MessageId,
    merkleRootHash: attestation.merkleRootHash,
    settlementType,
    status: 'cleared',
    reconciliationStatus: 'pending',
    settledAt: attestation.now,
  };
}
