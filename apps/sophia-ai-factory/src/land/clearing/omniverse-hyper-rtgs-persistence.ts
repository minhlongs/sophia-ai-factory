/**
 * @file omniverse-hyper-rtgs-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers for Omniverse Hyper-RTGS clearing, Netting 11.0, and Basel XV audits.
 */

import { getD1 } from '@/seed/db/client';
import type {
  OmniverseNettingResult,
  OmniverseHyperRtgsPaymentInput,
  OmniverseHyperRtgsPaymentValidationResult,
} from '@/tree/clearing/omniverse-hyper-rtgs-clearing-engine';
import type {
  BaselXvSolvencyInput,
  BaselXvSolvencyOutput,
} from '@/tree/reserve/basel-xv-solvency-engine';

export interface OmniverseHyperRtgsActionResult {
  success: boolean;
  data?: OmniverseHyperRtgsPaymentValidationResult;
  error?: string;
}

export interface OmniverseNettingActionResult {
  success: boolean;
  data?: OmniverseNettingResult;
  error?: string;
}

export interface BaselXvActionResult {
  success: boolean;
  data?: BaselXvSolvencyOutput;
  error?: string;
}

export async function persistOmniverseSession(
  params: OmniverseHyperRtgsPaymentInput,
  data: OmniverseHyperRtgsPaymentValidationResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO omniverse_hyper_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_picoseconds, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `OM-RTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'OMNIVERSE_EXPEDITE',
      data.status,
      data.executionLatencyPicoseconds,
      data.receiptHash,
      data.valid ? new Date().toISOString() : null,
    )
    .run();
}

export async function persistOmniverseNettingBatch(
  data: OmniverseNettingResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO omniverse_netting_batches (
         id, batch_ref, hyper_shard_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents,
         compression_ratio_pct, netting_status, multiverse_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `OM-NET-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

export async function persistBaselXvSolvencySnapshot(
  params: BaselXvSolvencyInput,
  data: BaselXvSolvencyOutput,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_xv_solvency_snapshots (
         id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, high_quality_liquidAssets_cents, net_cash_outflows_30d_cents,
         liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
         net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
         is_basel_xv_compliant, supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `BASEL-XV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
