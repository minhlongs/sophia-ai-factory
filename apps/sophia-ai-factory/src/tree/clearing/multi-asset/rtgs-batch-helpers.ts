/**
 * RTGS Settlement Helpers, Attestation & D1 Persistence
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/rtgs-batch-helpers
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClearingBatchStatus,
  ClearingExecutionResult,
  ExecuteClearingBatchInput,
  SettlementType,
  SwapQuoteResult,
} from '@/seed/types/multi-asset-clearing';
import { computeSha256 } from './currency-precision';

export function buildFailedResult(
  input: ExecuteClearingBatchInput,
  settlementType: SettlementType,
  status: ClearingBatchStatus,
  error: string,
  slippagePct = 0,
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

export interface RtgsAttestation {
  now: number;
  batchId: string;
  batchReference: string;
  uetr: string;
  iso20022MessageId: string;
  merkleRootHash: string;
}

export async function buildRtgsAttestation(
  input: ExecuteClearingBatchInput,
  targetAmount: number,
): Promise<RtgsAttestation> {
  const now = Date.now();
  const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();

  const batchId = `cbb_${dateStr}_${randomSuffix.toLowerCase()}`;
  const batchReference = `RTGS-${dateStr}-${randomSuffix}`;
  const uetr =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${randomSuffix}-0000-4000-8000-${dateStr}`;

  const iso20022MessageId = `urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10:${uetr}`;
  const merklePayload = `${batchReference}:${input.sourceAsset}:${input.targetAsset}:${input.grossAmount}:${targetAmount}:${uetr}:${now}`;
  const merkleRootHash = await computeSha256(merklePayload);

  return { now, batchId, batchReference, uetr, iso20022MessageId, merkleRootHash };
}

export async function persistClearedRtgsBatch(
  db: D1Database,
  input: ExecuteClearingBatchInput,
  settlementType: SettlementType,
  poolId: string,
  quote: SwapQuoteResult,
  attestation: RtgsAttestation,
): Promise<void> {
  const { now, batchId, batchReference, uetr, iso20022MessageId, merkleRootHash } = attestation;

  await db
    .prepare(
      `UPDATE clearing_liquidity_pools
       SET available_reserve_amount = available_reserve_amount - ?,
           daily_settlement_volume = daily_settlement_volume + ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(quote.targetAmount, quote.targetAmount, now, poolId)
    .run();

  const metadataJson = JSON.stringify({
    ...(input.metadata ?? {}),
    uetr,
    effectiveRate: quote.effectiveRate,
    marketRate: quote.marketRate,
    poolId,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      batchId, batchReference, 'instant_rtgs', input.sourceAsset, input.targetAsset,
      input.grossAmount, quote.targetAmount, quote.clearingFeeAmount, quote.slippagePct,
      settlementType, 'pending', input.bankingPartnerRef ?? null, iso20022MessageId,
      1, poolId, 'cleared', merkleRootHash, now, metadataJson, now, now,
    )
    .run();
}
