/**
 * D1 persistence helpers and result interfaces for Infinite Multiverse Hyper-RTGS Server Actions.
 * @module land/clearing/infinite-multiverse-hyper-rtgs-persistence
 */

import { getD1 } from '@/seed/db/client';
import type {
  InfiniteNettingExecutionResult,
  InfiniteRtgsValidationInput,
  InfiniteRtgsValidationOutput,
} from '@/tree/clearing/infinite-multiverse-hyper-rtgs-clearing-engine';
import type {
  BaselXxiSolvencyInput,
  BaselXxiSolvencyOutput,
} from '@/tree/reserve/basel-xxi-solvency-engine';

export interface InfiniteRtgsActionResult {
  success: boolean;
  data?: InfiniteRtgsValidationOutput;
  error?: string;
}

export interface InfiniteNettingActionResult {
  success: boolean;
  data?: InfiniteNettingExecutionResult;
  error?: string;
}

export interface BaselXxiSolvencyActionResult {
  success: boolean;
  data?: BaselXxiSolvencyOutput;
  error?: string;
}

export async function persistInfiniteRtgsSession(
  input: InfiniteRtgsValidationInput,
  data: InfiniteRtgsValidationOutput,
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO infinite_multiverse_hyper_rtgs_clearing_sessions (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_picoseconds, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `INF-RTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      input.sourceParticipantId,
      input.targetParticipantId,
      input.assetCurrency,
      input.grossAmountCents,
      input.priorityTier ?? 'INFINITE_SOVEREIGN_EXPEDITE',
      data.status,
      data.executionLatencyPicoseconds,
      data.receiptHash,
      new Date().toISOString(),
    )
    .run();
}

export async function persistInfiniteNettingBatch(
  data: InfiniteNettingExecutionResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO infinite_multiverse_netting_batches (
         id, batch_ref, hyper_shard_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents,
         compression_ratio_pct, netting_status, multiverse_solution_hash, executed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      data.batchRef,
      data.hyperShardCount,
      data.grossFlowCount,
      data.grossVolumeCents,
      data.netSettlementVolumeCents,
      data.compressionRatioPct,
      data.nettingStatus,
      data.multiverseSolutionHash,
      data.executedAt,
    )
    .run();
}

export async function persistBaselXxiSolvencyAudit(
  input: BaselXxiSolvencyInput,
  data: BaselXxiSolvencyOutput,
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO basel_xxi_solvency_audits (
         id, audit_ref, common_equity_tier1_cents, total_risk_exposure_cents,
         high_quality_liquid_assets_cents, net_cash_outflows_30_days_cents,
         available_stable_funding_cents, required_stable_funding_cents,
         sovereign_capital_buffer_cents, stress_test_survival_days,
         cet1_ratio_bps, lcr_bps, nsfr_bps, solvency_status,
         supervisory_signature, audited_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `BASEL-XXI-AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      input.commonEquityTier1Cents,
      input.totalRiskExposureCents,
      input.highQualityLiquidAssetsCents,
      input.netCashOutflows30DaysCents,
      input.availableStableFundingCents,
      input.requiredStableFundingCents,
      input.sovereignCapitalBufferCents,
      input.stressTestSurvivalDays,
      data.cet1RatioBps,
      data.liquidityCoverageRatioBps,
      data.netStableFundingRatioBps,
      data.solvencyStatus,
      data.supervisorySignature,
      new Date().toISOString(),
    )
    .run();
}
