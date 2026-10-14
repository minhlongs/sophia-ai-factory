/**
 * @file infinite-continuum-rtgs-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers for Infinite-Continuum RTGS clearing, Continuum netting, and Basel XI audits.
 */

import { getD1 } from '@/seed/db/client';
import type {
  ContinuumNettingResult,
  InfiniteContinuumRtgsPaymentInput,
  InfiniteContinuumRtgsPaymentValidationResult,
} from '@/tree/clearing/infinite-continuum-rtgs-clearing-engine';
import type {
  BaselXiSolvencyInput,
  BaselXiSolvencyOutput,
} from '@/tree/reserve/basel-xi-solvency-engine';

export interface InfiniteContinuumRtgsActionResult {
  success: boolean;
  data?: InfiniteContinuumRtgsPaymentValidationResult;
  error?: string;
}

export interface ContinuumNettingActionResult {
  success: boolean;
  data?: ContinuumNettingResult;
  error?: string;
}

export interface BaselXiActionResult {
  success: boolean;
  data?: BaselXiSolvencyOutput;
  error?: string;
}

export async function persistInfiniteContinuumSession(
  params: InfiniteContinuumRtgsPaymentInput,
  data: InfiniteContinuumRtgsPaymentValidationResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO infinite_continuum_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_nanos, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `ICRTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'WARP_EXPEDITE',
      data.status,
      data.executionLatencyNanos,
      data.receiptHash,
      new Date().toISOString(),
    )
    .run();
}

export async function persistContinuumNettingBatch(
  data: ContinuumNettingResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO continuum_netting_batches (
         id, batch_ref, hyper_shard_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
         netting_status, continuum_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `NET-CONT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      data.hyperShardCount,
      data.grossFlowCount,
      data.grossVolumeCents,
      data.netSettlementVolumeCents,
      data.compressionRatioPct,
      data.status,
      data.continuumSolutionHash,
      new Date().toISOString(),
    )
    .run();
}

export async function persistBaselXiSolvencySnapshot(
  input: BaselXiSolvencyInput,
  data: BaselXiSolvencyOutput,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_xi_solvency_snapshots (
         id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
         liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
         net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
         is_basel_xi_compliant, supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `BASELXI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      input.commonEquityTier1Cents,
      input.totalRiskExposureCents,
      data.cet1RatioBps,
      input.highQualityLiquidAssetsCents,
      input.netCashOutflows30DaysCents,
      data.liquidityCoverageRatioBps,
      input.availableStableFundingCents,
      input.requiredStableFundingCents,
      data.netStableFundingRatioBps,
      input.sovereignCapitalBufferCents,
      input.stressTestSurvivalDays,
      data.isSolvent ? 1 : 0,
      data.supervisorySignature,
    )
    .run();
}
