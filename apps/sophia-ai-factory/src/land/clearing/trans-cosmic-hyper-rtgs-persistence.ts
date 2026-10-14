/**
 * @file trans-cosmic-hyper-rtgs-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers for Trans-Cosmic Hyper-RTGS clearing, Hyper netting, and Basel XIII audits.
 */

import { getD1 } from '@/seed/db/client';
import type {
  HyperNettingResult,
  TransCosmicHyperRtgsPaymentInput,
  TransCosmicHyperRtgsPaymentValidationResult,
} from '@/tree/clearing/trans-cosmic-hyper-rtgs-clearing-engine';
import type {
  BaselXiiiSolvencyInput,
  BaselXiiiSolvencyOutput,
} from '@/tree/reserve/basel-xiii-solvency-engine';

export interface TransCosmicHyperRtgsActionResult {
  success: boolean;
  data?: TransCosmicHyperRtgsPaymentValidationResult;
  error?: string;
}

export interface HyperNettingActionResult {
  success: boolean;
  data?: HyperNettingResult;
  error?: string;
}

export interface BaselXiiiActionResult {
  success: boolean;
  data?: BaselXiiiSolvencyOutput;
  error?: string;
}

export async function persistTransCosmicSession(
  params: TransCosmicHyperRtgsPaymentInput,
  data: TransCosmicHyperRtgsPaymentValidationResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO trans_cosmic_hyper_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_picoseconds, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `TC-RTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      params.sourceParticipantId,
      params.targetParticipantId,
      params.assetCurrency,
      params.grossAmountCents,
      params.priorityTier ?? 'TRANS_COSMIC_EXPEDITE',
      data.status,
      data.executionLatencyPicoseconds,
      data.receiptHash,
      data.valid ? new Date().toISOString() : null,
    )
    .run();
}

export async function persistHyperNettingBatch(
  data: HyperNettingResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO hyper_netting_batches (
         id, batch_ref, hyper_shard_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents,
         compression_ratio_pct, netting_status, multiverse_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `H-NET-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

export async function persistBaselXiiiSolvencySnapshot(
  params: BaselXiiiSolvencyInput,
  data: BaselXiiiSolvencyOutput,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_xiii_solvency_snapshots (
         id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
         liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
         net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
         is_basel_xiii_compliant, supervisory_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `BASEL-XIII-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
