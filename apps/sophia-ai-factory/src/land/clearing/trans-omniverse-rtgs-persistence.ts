/**
 * @file trans-omniverse-rtgs-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers for Trans-Omniverse RTGS clearing, Trans-Cosmic netting, and Basel X audits.
 */

import { getD1 } from '@/seed/db/client';
import type {
  TransCosmicNettingResult,
  TransOmniverseRtgsPaymentInput,
  TransOmniverseRtgsPaymentValidationResult,
} from '@/tree/clearing/trans-omniverse-rtgs-clearing-engine';
import type {
  BaselXSolvencyInput,
  BaselXSolvencyOutput,
} from '@/tree/reserve/basel-x-solvency-engine';

export interface TransOmniverseRtgsActionResult {
  success: boolean;
  data?: TransOmniverseRtgsPaymentValidationResult;
  error?: string;
}

export interface TransCosmicNettingActionResult {
  success: boolean;
  data?: TransCosmicNettingResult;
  error?: string;
}

export interface BaselXActionResult {
  success: boolean;
  data?: BaselXSolvencyOutput;
  error?: string;
}

export async function persistTransOmniverseSession(
  params: TransOmniverseRtgsPaymentInput,
  data: TransOmniverseRtgsPaymentValidationResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO trans_omniverse_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_nanos, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `TORTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'SUB_PLANCK_EXPEDITE',
      data.status,
      data.executionLatencyNanos,
      data.receiptHash,
      new Date().toISOString(),
    )
    .run();
}

export async function persistTransCosmicNettingBatch(
  data: TransCosmicNettingResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO trans_cosmic_netting_batches (
         id, batch_ref, hyper_shard_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
         netting_status, trans_cosmic_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `NET-COSMIC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      data.hyperShardCount,
      data.grossFlowCount,
      data.grossVolumeCents,
      data.netSettlementVolumeCents,
      data.compressionRatioPct,
      data.status,
      data.transCosmicSolutionHash,
      new Date().toISOString(),
    )
    .run();
}

export async function persistBaselXSolvencySnapshot(
  input: BaselXSolvencyInput,
  data: BaselXSolvencyOutput,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_x_solvency_snapshots (
         id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
         liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
         net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
         is_basel_x_compliant, supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `BASELX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
