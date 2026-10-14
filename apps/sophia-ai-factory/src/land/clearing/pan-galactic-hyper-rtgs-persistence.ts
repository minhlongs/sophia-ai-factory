/**
 * @file pan-galactic-hyper-rtgs-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers for Pan-Galactic Hyper-RTGS clearing, Netting 10.0, and Basel XIV audits.
 */

import { getD1 } from '@/seed/db/client';
import type {
  PanGalacticNettingResult,
  PanGalacticHyperRtgsPaymentInput,
  PanGalacticHyperRtgsPaymentValidationResult,
} from '@/tree/clearing/pan-galactic-hyper-rtgs-clearing-engine';
import type {
  BaselXivSolvencyInput,
  BaselXivSolvencyOutput,
} from '@/tree/reserve/basel-xiv-solvency-engine';

export interface PanGalacticHyperRtgsActionResult {
  success: boolean;
  data?: PanGalacticHyperRtgsPaymentValidationResult;
  error?: string;
}

export interface PanGalacticNettingActionResult {
  success: boolean;
  data?: PanGalacticNettingResult;
  error?: string;
}

export interface BaselXivActionResult {
  success: boolean;
  data?: BaselXivSolvencyOutput;
  error?: string;
}

export async function persistPanGalacticSession(
  params: PanGalacticHyperRtgsPaymentInput,
  data: PanGalacticHyperRtgsPaymentValidationResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO pan_galactic_hyper_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_picoseconds, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `PG-RTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'PAN_GALACTIC_EXPEDITE',
      data.status,
      data.executionLatencyPicoseconds,
      data.receiptHash,
      data.valid ? new Date().toISOString() : null,
    )
    .run();
}

export async function persistPanGalacticNettingBatch(
  data: PanGalacticNettingResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO pan_galactic_netting_batches (
         id, batch_ref, hyper_shard_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents,
         compression_ratio_pct, netting_status, multiverse_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `PG-NET-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      data.hyperShardCount,
      data.grossFlowCount,
      data.grossVolumeCents,
      data.netSettlementVolumeCents,
      data.compressionRatioPct,
      data.status,
      data.multiverseSolutionHash,
      new Date().toISOString(),
    )
    .run();
}

export async function persistBaselXivSolvencySnapshot(
  params: BaselXivSolvencyInput,
  data: BaselXivSolvencyOutput,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_xiv_solvency_snapshots (
         id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
         liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
         net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
         is_basel_xiv_compliant, supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `BASEL-XIV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      params.commonEquityTier1Cents,
      params.totalRiskExposureCents,
      data.cet1RatioBps,
      params.highQualityLiquidAssetsCents,
      params.netCashOutflows30DaysCents,
      data.liquidityCoverageRatioBps,
      params.availableStableFundingCents,
      params.requiredStableFundingCents,
      data.netStableFundingRatioBps,
      data.sovereignCapitalBufferCents,
      data.stressTestSurvivalDays,
      data.isSolvent ? 1 : 0,
      data.supervisorySignature,
    )
    .run();
}
