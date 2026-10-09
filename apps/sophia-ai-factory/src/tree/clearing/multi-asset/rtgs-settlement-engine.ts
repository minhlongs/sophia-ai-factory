/**
 * T+0 RTGS Settlement Pipeline & Merkle Proof Attestation
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/rtgs-settlement-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClearingBatchStatus,
  ClearingExecutionResult,
  ClearingLiquidityPoolRow,
  ExecuteClearingBatchInput,
  SettlementType,
} from '@/seed/types/multi-asset-clearing';
import {
  MAX_SLIPPAGE_TOLERANCE_PCT,
  rowToClearingLiquidityPool,
} from '@/seed/types/multi-asset-clearing';
import { logger } from '@/seed/utils/logger-utility';
import { computeSha256 } from './currency-precision';
import { calculateSwapQuote } from './virtual-amm-engine';

function buildFailedResult(
  input: ExecuteClearingBatchInput,
  settlementType: SettlementType,
  status: ClearingBatchStatus,
  error: string,
  slippagePct = 0
): ClearingExecutionResult {
  return {
    success: false,
    batchId: '',
    batchReference: '',
    sourceAsset: input.sourceAsset,
    targetAsset: input.targetAsset,
    grossAmount: input.grossAmount,
    netClearedAmount: 0,
    clearingFeeAmount: 0,
    slippageRealizedPct: slippagePct,
    iso20022MessageId: '',
    merkleRootHash: '',
    settlementType,
    status,
    reconciliationStatus: 'pending',
    settledAt: 0,
    error,
  };
}

/**
 * Executes a T+0 Real-Time Gross Settlement (RTGS) batch.
 * Verifies liquidity, confirms strict slippage (< 0.05%), records Merkle attestation,
 * updates pool reserves, and persists batch record into D1.
 */
export async function executeRtgsBatch(
  db: D1Database,
  input: ExecuteClearingBatchInput
): Promise<ClearingExecutionResult> {
  const { sourceAsset, targetAsset, grossAmount } = input;
  const settlementType = input.settlementType ?? 'T0_RTGS';

  const targetPoolRow = await db
    .prepare(
      `SELECT * FROM clearing_liquidity_pools
       WHERE asset_symbol = ? AND status = 'active'
       ORDER BY available_reserve_amount DESC LIMIT 1`
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
      input, settlementType, 'rejected',
      `SLIPPAGE_EXCEEDED: Realized ${quote.slippagePct.toFixed(4)}% exceeds 0.05% tolerance cap`,
      quote.slippagePct
    );
  }

  if (quote.targetAmount > pool.availableReserveAmount) {
    return buildFailedResult(input, settlementType, 'rejected', 'INSUFFICIENT_POOL_RESERVE', quote.slippagePct);
  }

  const now = Date.now();
  const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();

  const batchId = `cbb_${dateStr}_${randomSuffix.toLowerCase()}`;
  const batchReference = `RTGS-${dateStr}-${randomSuffix}`;
  const uetr = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${randomSuffix}-0000-4000-8000-${dateStr}`;

  const iso20022MessageId = `urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10:${uetr}`;
  const merklePayload = `${batchReference}:${sourceAsset}:${targetAsset}:${grossAmount}:${quote.targetAmount}:${uetr}:${now}`;
  const merkleRootHash = await computeSha256(merklePayload);

  await db
    .prepare(
      `UPDATE clearing_liquidity_pools
       SET available_reserve_amount = available_reserve_amount - ?,
           daily_settlement_volume = daily_settlement_volume + ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(quote.targetAmount, quote.targetAmount, now, pool.id)
    .run();

  const metadataJson = JSON.stringify({
    ...(input.metadata ?? {}),
    uetr,
    effectiveRate: quote.effectiveRate,
    marketRate: quote.marketRate,
    poolId: pool.id,
    bankingPartnerRef: input.bankingPartnerRef ?? null,
  });

  await db
    .prepare(
      `INSERT INTO cross_border_clearing_batches (
        id, batch_reference, batch_cycle, source_asset, target_asset,
        gross_amount, net_cleared_amount, clearing_fee_amount, slippage_realized_pct,
        settlement_type, reconciliation_status, banking_partner_ref, iso20022_message_id,
        participant_count, pool_id, status, merkle_root_hash, settled_at,
        metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      batchId, batchReference, 'instant_rtgs', sourceAsset, targetAsset,
      grossAmount, quote.targetAmount, quote.clearingFeeAmount, quote.slippagePct,
      settlementType, 'pending', input.bankingPartnerRef ?? null, iso20022MessageId,
      1, pool.id, 'cleared', merkleRootHash, now, metadataJson, now, now
    )
    .run();

  logger.info('T+0 RTGS settlement batch cleared', {
    batchId, batchReference, sourceAsset, targetAsset, grossAmount,
    netClearedAmount: quote.targetAmount, slippagePct: quote.slippagePct,
  });

  return {
    success: true,
    batchId,
    batchReference,
    sourceAsset,
    targetAsset,
    grossAmount,
    netClearedAmount: quote.targetAmount,
    clearingFeeAmount: quote.clearingFeeAmount,
    slippageRealizedPct: quote.slippagePct,
    iso20022MessageId,
    merkleRootHash,
    settlementType,
    status: 'cleared',
    reconciliationStatus: 'pending',
    settledAt: now,
  };
}
