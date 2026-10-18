/**
 * Shared D1 Persistence Helpers for Hyper-RTGS Clearing, Netting, and Basel Solvency Audits.
 * @module land/clearing/hyper-rtgs-persistence-helpers
 */

import { getD1 } from '@/seed/db/client';

export { insertBaselSolvencyAuditRow } from './hyper-rtgs-basel-audit-persistence';

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
