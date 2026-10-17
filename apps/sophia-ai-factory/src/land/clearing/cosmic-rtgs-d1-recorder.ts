/**
 * @file cosmic-rtgs-d1-recorder.ts
 * @layer land/clearing
 * @description Shared D1 persistence helper for Galactic-RTGS and Omniverse-RTGS clearing, netting batches, and Basel VIII/IX solvency snapshots.
 */

import { getD1 } from '@/seed/db/client';

export interface CosmicRtgsSessionRecordInput {
  tablePrefix: 'galactic' | 'omniverse';
  sessionRefPrefix: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: string;
  grossAmountCents: number;
  priorityTier: string;
  status: string;
  executionLatencyNanos: number;
  receiptHash: string;
}

export interface CosmicNettingBatchRecordInput {
  tableName: 'fractal_multilateral_netting_batches' | 'hyper_dimensional_netting_batches';
  batchRefPrefix: string;
  shardCountColumn: 'hierarchical_shard_count' | 'multidimensional_shard_count';
  solutionHashColumn: 'fractal_solution_hash' | 'hyper_dimensional_solution_hash';
  shardCount: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  status: string;
  solutionHash: string;
}

export interface CosmicSolvencySnapshotRecordInput {
  tableName: 'basel_viii_solvency_snapshots' | 'basel_ix_solvency_snapshots';
  snapshotRefPrefix: string;
  bufferColumn: 'sovereign_planetary_capital_buffer_cents' | 'multidimensional_capital_buffer_cents';
  compliantColumn: 'is_basel_viii_compliant' | 'is_basel_ix_compliant';
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  cet1RatioBps: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  liquidityCoverageRatioBps: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  isSolvent: boolean;
  supervisorySignature: string;
}

export async function recordCosmicRtgsSession(p: CosmicRtgsSessionRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tablePrefix}_rtgs_clearing_sessions (id, session_ref, source_participant_id, target_participant_id, asset_currency, gross_amount_cents, priority_tier, settlement_status, execution_latency_nanos, clearing_receipt_hash, settled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(), `${p.sessionRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      p.sourceParticipantId, p.targetParticipantId, p.assetCurrency, p.grossAmountCents,
      p.priorityTier, p.status, p.executionLatencyNanos, p.receiptHash
    )
    .run();
}

export async function recordCosmicNettingBatch(p: CosmicNettingBatchRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, batch_ref, ${p.shardCountColumn}, gross_flow_count, gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct, netting_status, ${p.solutionHashColumn}, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(), `${p.batchRefPrefix}-${Date.now()}`, p.shardCount, p.grossFlowCount,
      p.grossVolumeCents, p.netSettlementVolumeCents, p.compressionRatioPct, p.status, p.solutionHash
    )
    .run();
}

export async function recordCosmicSolvencySnapshot(p: CosmicSolvencySnapshotRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents, cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents, liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents, net_stable_funding_ratio_bps, ${p.bufferColumn}, stress_test_survival_days, ${p.compliantColumn}, supervisory_signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(), `${p.snapshotRefPrefix}-${Date.now()}`, p.commonEquityTier1Cents,
      p.totalRiskExposureCents, p.cet1RatioBps, p.highQualityLiquidAssetsCents,
      p.netCashOutflows30DaysCents, p.liquidityCoverageRatioBps, p.availableStableFundingCents,
      p.requiredStableFundingCents, p.netStableFundingRatioBps, p.totalLiquidityBufferCents,
      p.stressTestSurvivalDays, p.isSolvent ? 1 : 0, p.supervisorySignature
    )
    .run();
}
