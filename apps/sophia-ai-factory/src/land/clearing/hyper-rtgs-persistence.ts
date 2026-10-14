/**
 * @file hyper-rtgs-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers and result contracts for Hyper-RTGS clearing, distributed netting, and Basel VII audits.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  DistributedMultilateralNettingResult,
  HyperRtgsValidationInput,
  HyperRtgsValidationOutput,
} from '@/tree/clearing/hyper-rtgs-clearing-engine';
import type {
  BaselViiSolvencyInput,
  BaselViiSolvencyOutput,
} from '@/tree/reserve/basel-vii-solvency-engine';

export interface HyperRtgsActionResult {
  success: boolean;
  data?: HyperRtgsValidationOutput;
  error?: string;
}

export interface DistributedNettingActionResult {
  success: boolean;
  data?: DistributedMultilateralNettingResult;
  error?: string;
}

export interface BaselViiActionResult {
  success: boolean;
  data?: BaselViiSolvencyOutput;
  error?: string;
}

export async function insertHyperRtgsSessionRecord(
  db: D1Database,
  params: HyperRtgsValidationInput,
  data: HyperRtgsValidationOutput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO hyper_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_nanos, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `hrtgs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      `HRTGS_${params.sourceParticipantId}_${Date.now()}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'WARP_EXPEDITE',
      data.status,
      data.executionLatencyNanos,
      data.receiptHash,
      data.valid ? new Date().toISOString() : null,
    )
    .run();
}

export async function insertDistributedNettingBatchRecord(
  db: D1Database,
  data: DistributedMultilateralNettingResult,
): Promise<void> {
  const batchRef = `DIST_NET_${Date.now()}`;
  await db
    .prepare(
      `INSERT INTO distributed_multilateral_netting_batches (
         id, batch_ref, network_partition_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
         netting_status, graph_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `dbatch_${Date.now()}`,
      batchRef,
      data.networkPartitionCount,
      data.grossFlowCount,
      data.grossVolumeCents,
      data.netSettlementVolumeCents,
      data.compressionRatioPct,
      data.status,
      data.graphSolutionHash,
      new Date().toISOString(),
    )
    .run();
}

export async function insertBaselViiSnapshotRecord(
  db: D1Database,
  params: BaselViiSolvencyInput,
  data: BaselViiSolvencyOutput,
  snapshotRef: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO basel_vii_solvency_snapshots (
         id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
         liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
         net_stable_funding_ratio_bps, interstellar_capital_buffer_cents, stress_test_survival_days,
         is_basel_vii_compliant, supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `bvii_${Date.now()}`,
      snapshotRef,
      params.commonEquityTier1Cents,
      params.totalRiskExposureCents,
      data.cet1RatioBps,
      params.highQualityLiquidAssetsCents,
      params.netCashOutflows30DaysCents,
      data.liquidityCoverageRatioBps,
      params.availableStableFundingCents,
      params.requiredStableFundingCents,
      data.netStableFundingRatioBps,
      data.totalLiquidityBufferCents,
      data.stressTestSurvivalDays,
      data.isSolvent ? 1 : 0,
      data.supervisorySignature,
    )
    .run();
}
