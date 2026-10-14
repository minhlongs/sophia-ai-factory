/**
 * @file super-rtgs-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers and result interfaces for Super-RTGS clearing, parallel netting, and Basel VI audits.
 */

import { getD1 } from '@/seed/db/client';
import type {
  ParallelMultilateralNettingResult,
  SuperRtgsValidationInput,
  SuperRtgsValidationOutput,
} from '@/tree/clearing/super-rtgs-clearing-engine';
import type {
  BaselViSolvencyInput,
  BaselViSolvencyOutput,
} from '@/tree/reserve/basel-vi-solvency-engine';

export interface SuperRtgsActionResult {
  success: boolean;
  data?: SuperRtgsValidationOutput;
  error?: string;
}

export interface ParallelNettingActionResult {
  success: boolean;
  data?: ParallelMultilateralNettingResult;
  error?: string;
}

export interface BaselViActionResult {
  success: boolean;
  data?: BaselViSolvencyOutput;
  error?: string;
}

export async function persistSuperRtgsClearingSession(
  params: SuperRtgsValidationInput,
  data: SuperRtgsValidationOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO super_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_nanos, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `srtgs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      `SRTGS_${params.sourceParticipantId}_${Date.now()}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'STANDARD_COMMERCIAL',
      data.status,
      data.executionLatencyNanos,
      data.receiptHash,
      data.valid ? new Date().toISOString() : null
    )
    .run();
}

export async function persistParallelNettingBatch(
  data: ParallelMultilateralNettingResult
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  const batchRef = `PAR_NET_${Date.now()}`;
  await db
    .prepare(
      `INSERT INTO parallel_multilateral_netting_batches (
         id, batch_ref, parallel_partition_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
         participant_count, netting_status, graph_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `pbatch_${Date.now()}`,
      batchRef,
      data.parallelPartitionCount,
      data.grossFlowCount,
      data.grossVolumeCents,
      data.netSettlementVolumeCents,
      data.compressionRatioPct,
      Object.keys(data.netPositions).length,
      data.status,
      data.graphSolutionHash,
      new Date().toISOString()
    )
    .run();
}

export async function persistBaselViSolvencySnapshot(
  params: BaselViSolvencyInput,
  auditCycle: string,
  data: BaselViSolvencyOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_vi_solvency_snapshots (
         id, audit_cycle, common_equity_tier_1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, liquidity_coverage_ratio_bps, net_stable_funding_ratio_bps,
         total_liquidity_buffer_cents, stress_test_survival_days, is_solvent,
         supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `bvi_${Date.now()}`,
      auditCycle,
      params.commonEquityTier1Cents,
      params.totalRiskExposureCents,
      data.cet1RatioBps,
      data.liquidityCoverageRatioBps,
      data.netStableFundingRatioBps,
      data.totalLiquidityBufferCents,
      data.stressTestSurvivalDays,
      data.isSolvent ? 1 : 0,
      data.supervisorySignature
    )
    .run();
}
