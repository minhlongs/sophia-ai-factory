/**
 * @file hyper-rtgs-d1-recorder.ts
 * @layer land/clearing
 * @description Shared D1 persistence helper for Trans-Cosmic Hyper-RTGS clearing, netting batches, and Basel solvency audits.
 */

import { getD1 } from '@/seed/db/client';

export interface HyperRtgsSessionRecordInput {
  tablePrefix: string;
  sessionRefPrefix: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: string;
  grossAmountCents: number;
  priorityTier: string;
  status: string;
  executionLatencyPicoseconds: number;
  receiptHash: string;
  includeCreatedAt?: boolean;
}

export interface HyperRtgsNettingBatchData {
  batchRef: string;
  hyperShardCount: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: string;
  multiverseSolutionHash: string;
}

export interface HyperRtgsSolvencyRecordInput {
  tableName: string;
  auditRefPrefix: string;
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
  hqlaColumnName?: 'highQuality_liquid_assets_cents' | 'high_quality_liquid_assets_cents';
  includeCreatedAt?: boolean;
  includeTrailingTimestamp?: boolean;
}

export async function recordHyperRtgsSession(p: HyperRtgsSessionRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  const cols = p.includeCreatedAt ?? true ? ', created_at' : '';
  const vals = p.includeCreatedAt ?? true ? ", datetime('now')" : '';
  await db
    .prepare(
      `INSERT INTO ${p.tablePrefix}_hyper_rtgs_clearing_sessions (id, session_ref, source_participant_id, target_participant_id, asset_currency, gross_amount_cents, priority_tier, settlement_status, execution_latency_picoseconds, clearing_receipt_hash, settled_at${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')${vals})`
    )
    .bind(
      crypto.randomUUID(), `${p.sessionRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      p.sourceParticipantId, p.targetParticipantId, p.assetCurrency, p.grossAmountCents,
      p.priorityTier, p.status, p.executionLatencyPicoseconds, p.receiptHash
    )
    .run();
}

export async function recordHyperRtgsNettingBatch(
  tablePrefix: string,
  d: HyperRtgsNettingBatchData,
  includeCreatedAt: boolean = true
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  const cols = includeCreatedAt ? ', created_at' : '';
  const vals = includeCreatedAt ? ", datetime('now')" : '';
  await db
    .prepare(
      `INSERT INTO ${tablePrefix}_netting_batches (id, batch_ref, hyper_shard_count, gross_flow_count, gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct, netting_status, multiverse_solution_hash, executed_at${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')${vals})`
    )
    .bind(
      crypto.randomUUID(), d.batchRef, d.hyperShardCount, d.grossFlowCount, d.grossVolumeCents,
      d.netSettlementVolumeCents, d.compressionRatioPct, d.nettingStatus, d.multiverseSolutionHash
    )
    .run();
}

export async function recordHyperRtgsSolvencyAudit(p: HyperRtgsSolvencyRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  const hqlaCol = p.hqlaColumnName ?? 'highQuality_liquid_assets_cents';
  const cols = p.includeCreatedAt ?? true ? ', created_at' : '';
  const vals = p.includeCreatedAt ?? true ? ", datetime('now')" : '';
  const bindArgs: (string | number)[] = [
    crypto.randomUUID(), `${p.auditRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    p.commonEquityTier1Cents, p.totalRiskExposureCents, p.highQualityLiquidAssetsCents,
    p.netCashOutflows30DaysCents, p.availableStableFundingCents, p.requiredStableFundingCents,
    p.sovereignCapitalBufferCents, p.stressTestSurvivalDays, p.cet1RatioBps,
    p.liquidityCoverageRatioBps, p.netStableFundingRatioBps, p.solvencyStatus, p.supervisorySignature,
  ];
  if (p.includeTrailingTimestamp) bindArgs.push(new Date().toISOString());
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, audit_ref, common_equity_tier1_cents, total_risk_exposure_cents, ${hqlaCol}, net_cash_outflows_30_days_cents, available_stable_funding_cents, required_stable_funding_cents, sovereign_capital_buffer_cents, stress_test_survival_days, cet1_ratio_bps, lcr_bps, nsfr_bps, solvency_status, supervisory_signature, audited_at${cols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')${vals})`
    )
    .bind(...bindArgs)
    .run();
}
