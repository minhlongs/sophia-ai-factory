'use server';

/**
 * @file cls-pvp-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for CLS PvP atomic settlement and Basel IV capital audit.
 */

import { getD1 } from '@/seed/db/client';
import { executeAtomicPvpSettlement, validatePvpLegEquivalence } from '@/tree/clearing/cls-pvp-settlement-engine';
import { evaluateBaselIvCapital } from '@/tree/reserve/basel-iv-capital-engine';
import type {
  ClsPvpSettlementSession,
  PvpExecutionRequest,
  PvpExecutionResult,
  BaselIvCapitalAdequacySnapshot,
} from '@/seed/types/cls-liquidity';

export interface ExecuteClsPvpActionParams {
  session: ClsPvpSettlementSession;
  request: PvpExecutionRequest;
}

export interface ClsPvpActionResult {
  success: boolean;
  result?: PvpExecutionResult;
  error?: string;
}

export async function executeClsPvpAction(
  params: ExecuteClsPvpActionParams
): Promise<ClsPvpActionResult> {
  try {
    const result = executeAtomicPvpSettlement(params.session, params.request);
    const db = await getD1();

    if (db) {
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
          `cls_${params.session.sessionRef}`,
          params.session.sessionRef,
          params.session.leg1Currency,
          params.request.leg1AmountCents,
          params.session.leg1SourceInstitution,
          params.session.leg2Currency,
          params.request.leg2AmountCents,
          params.session.leg2SourceInstitution,
          params.request.spotRate,
          result.status,
          result.atomicSettlementProofSha256,
          result.settledTimestamp,
          result.status,
          result.settledTimestamp
        )
        .run();
    }

    return { success: result.status === 'EXECUTED_PVP', result };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface AuditBaselIvActionParams {
  auditQuarter: string;
  tier1CapitalCents: number;
  riskWeightedAssetsCents: number;
  hqlaLiquidAssetsCents: number;
  netCashOutflows30dCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
}

export interface AuditBaselIvActionResult {
  success: boolean;
  snapshot?: BaselIvCapitalAdequacySnapshot;
  error?: string;
}

export async function auditBaselIvCapitalAction(
  params: AuditBaselIvActionParams
): Promise<AuditBaselIvActionResult> {
  try {
    const evaluation = evaluateBaselIvCapital(
      params.tier1CapitalCents,
      params.riskWeightedAssetsCents,
      params.hqlaLiquidAssetsCents,
      params.netCashOutflows30dCents,
      params.availableStableFundingCents,
      params.requiredStableFundingCents
    );

    const snapshot: BaselIvCapitalAdequacySnapshot = {
      id: `BASEL_IV_${params.auditQuarter}`,
      auditQuarter: params.auditQuarter,
      tier1CapitalCents: params.tier1CapitalCents,
      riskWeightedAssetsCents: params.riskWeightedAssetsCents,
      cet1RatioBps: evaluation.cet1RatioBps,
      liquidityCoverageRatioBps: evaluation.liquidityCoverageRatioBps,
      netStableFundingRatioBps: evaluation.netStableFundingRatioBps,
      sovereignBufferAllocatedCents: 100_000_000_000, // $1B allocated buffer
      isCompliant: evaluation.isCompliant,
      snapshotHash: `hash_${params.auditQuarter}_${evaluation.cet1RatioBps}`,
      createdAt: new Date().toISOString(),
    };

    const db = await getD1();
    if (db) {
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

    return { success: true, snapshot };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
