/**
 * Shared D1 Persistence Helpers for Hyper-RTGS Clearing, Netting, and Basel Solvency Audits.
 * @module land/clearing/hyper-rtgs-persistence-helpers
 */

import { getD1 } from '@/seed/db/client';

export async function insertHyperRtgsSessionRow(
  tableName: string,
  sessionRef: string,
  input: {
    sourceParticipantId: string;
    targetParticipantId: string;
    assetCurrency: string;
    grossAmountCents: number;
    priorityTier?: string;
  },
  defaultPriorityTier: string,
  data: {
    status: string;
    executionLatencyPicoseconds: number;
    receiptHash: string;
  },
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${tableName} (
         id, session_ref, source_participant_id, target_participant_id,
         asset_currency, gross_amount_cents, priority_tier, settlement_status,
         execution_latency_picoseconds, clearing_receipt_hash, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      sessionRef,
      input.sourceParticipantId,
      input.targetParticipantId,
      input.assetCurrency,
      input.grossAmountCents,
      input.priorityTier ?? defaultPriorityTier,
      data.status,
      data.executionLatencyPicoseconds,
      data.receiptHash,
      new Date().toISOString(),
    )
    .run();
}

export async function insertHyperNettingBatchRow(
  tableName: string,
  data: {
    batchRef: string;
    hyperShardCount: number;
    grossFlowCount: number;
    grossVolumeCents: number;
    netSettlementVolumeCents: number;
    compressionRatioPct: number;
    nettingStatus: string;
    multiverseSolutionHash: string;
    executedAt?: string;
  },
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${tableName} (
         id, batch_ref, hyper_shard_count, gross_flow_count,
         gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
         netting_status, multiverse_solution_hash, executed_at
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
      data.executedAt ?? new Date().toISOString(),
    )
    .run();
}

export async function insertBaselSolvencyAuditRow(
  tableName: string,
  auditRef: string,
  values: {
    commonEquityTier1Cents: number;
    totalRiskExposureCents: number;
    highQualityLiquidAssetsCents: number;
    netCashOutflows30DaysCents: number;
    availableStableFundingCents: number;
    requiredStableFundingCents: number;
    sovereignCapitalBufferCents: number;
    stressTestSurvivalDays: number;
    cet1RatioBps: number;
    liquidityCoverageRatioBps: number;
    netStableFundingRatioBps: number;
    solvencyStatus: string;
    supervisorySignature: string;
  },
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${tableName} (
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
      auditRef,
      values.commonEquityTier1Cents,
      values.totalRiskExposureCents,
      values.highQualityLiquidAssetsCents,
      values.netCashOutflows30DaysCents,
      values.availableStableFundingCents,
      values.requiredStableFundingCents,
      values.sovereignCapitalBufferCents,
      values.stressTestSurvivalDays,
      values.cet1RatioBps,
      values.liquidityCoverageRatioBps,
      values.netStableFundingRatioBps,
      values.solvencyStatus,
      values.supervisorySignature,
      new Date().toISOString(),
    )
    .run();
}
