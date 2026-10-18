/**
 * @file cls-pvp-persistence.ts
 * @layer land/clearing
 * @description D1 persistence helpers for CLS PvP atomic settlement and Basel IV capital adequacy snapshots.
 */

import { getD1 } from '@/seed/db/client';
import type {
  ClsPvpSettlementSession,
  PvpExecutionRequest,
  PvpExecutionResult,
  BaselIvCapitalAdequacySnapshot,
} from '@/seed/types/cls-liquidity';

export async function recordClsPvpSettlementSession(
  session: ClsPvpSettlementSession,
  request: PvpExecutionRequest,
  result: PvpExecutionResult
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO cls_pvp_settlement_sessions (
         id, session_ref, leg_1_currency, leg_1_amount_cents,
         leg_1_source_institution, leg_2_currency, leg_2_amount_cents,
         leg_2_source_institution, exchange_rate, atomic_status,
         clearing_hash_sha256, settled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_ref) DO UPDATE SET
         atomic_status = ?,
         settled_at = ?`
    )
    .bind(
      `cls_${session.sessionRef}`,
      session.sessionRef,
      session.leg1Currency,
      request.leg1AmountCents,
      session.leg1SourceInstitution,
      session.leg2Currency,
      request.leg2AmountCents,
      session.leg2SourceInstitution,
      request.spotRate,
      result.status,
      result.atomicSettlementProofSha256,
      result.settledTimestamp,
      result.status,
      result.settledTimestamp
    )
    .run();
}

export async function recordBaselIvCapitalAdequacySnapshot(
  snapshot: BaselIvCapitalAdequacySnapshot
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO basel_iv_capital_adequacy_snapshots (
         id, audit_quarter, tier_1_capital_cents, risk_weighted_assets_cents,
         cet1_ratio_bps, liquidity_coverage_ratio_bps, net_stable_funding_ratio_bps,
         sovereign_buffer_allocated_cents, is_compliant, snapshot_hash
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(audit_quarter) DO UPDATE SET
         cet1_ratio_bps = ?,
         liquidity_coverage_ratio_bps = ?,
         net_stable_funding_ratio_bps = ?,
         is_compliant = ?`
    )
    .bind(
      snapshot.id,
      snapshot.auditQuarter,
      snapshot.tier1CapitalCents,
      snapshot.riskWeightedAssetsCents,
      snapshot.cet1RatioBps,
      snapshot.liquidityCoverageRatioBps,
      snapshot.netStableFundingRatioBps,
      snapshot.sovereignBufferAllocatedCents,
      snapshot.isCompliant ? 1 : 0,
      snapshot.snapshotHash,
      snapshot.cet1RatioBps,
      snapshot.liquidityCoverageRatioBps,
      snapshot.netStableFundingRatioBps,
      snapshot.isCompliant ? 1 : 0
    )
    .run();
}
