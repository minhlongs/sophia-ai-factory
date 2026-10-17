/**
 * @file rtgs-clearing-d1-helpers.ts
 * @layer land/clearing
 * @description D1 persistence helpers for RTGS payment processing, multilateral netting, and Basel V solvency audits.
 */

import { getD1 } from '@/seed/db/client';
import type {
  MultilateralNettingResult,
  RtgsValidationInput,
  RtgsValidationOutput,
} from '@/tree/clearing/rtgs-clearing-engine';
import type { BaselVSolvencyInput, BaselVSolvencyOutput } from '@/tree/reserve/basel-v-solvency-engine';

export async function persistRtgsPaymentSession(
  params: RtgsValidationInput,
  data: RtgsValidationOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_micros, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `rtgs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      `RTGS_${params.sourceParticipantId}_${Date.now()}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'STANDARD_COMMERCIAL',
      data.status,
      45,
      data.receiptHash,
      data.valid ? new Date().toISOString() : null
    )
    .run();
}

export async function persistMultilateralNettingBatch(
  data: MultilateralNettingResult
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  const batchRef = `NET_CYCLE_${Date.now()}`;
  await db
    .prepare(
      `INSERT INTO multilateral_netting_batches (
         id, batch_ref, cycle_interval_seconds, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
         participant_count, netting_status, graph_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `batch_${Date.now()}`,
      batchRef,
      60,
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

export async function persistBaselVSolvencySnapshot(
  params: BaselVSolvencyInput,
  data: BaselVSolvencyOutput,
  auditCycle: string
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_v_solvency_snapshots (
         id, audit_cycle, common_equity_tier_1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, liquidity_coverage_ratio_bps, net_stable_funding_ratio_bps,
         total_liquidity_buffer_cents, stress_test_survival_days, is_solvent,
         supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `bv_${Date.now()}`,
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
