'use server';

/**
 * @file cls-pvp-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for CLS PvP atomic settlement and Basel IV capital audit.
 */

import { executeAtomicPvpSettlement } from '@/tree/clearing/cls-pvp-settlement-engine';
import { evaluateBaselIvCapital } from '@/tree/reserve/basel-iv-capital-engine';
import type {
  ClsPvpSettlementSession,
  PvpExecutionRequest,
  PvpExecutionResult,
  BaselIvCapitalAdequacySnapshot,
} from '@/seed/types/cls-liquidity';
import {
  recordClsPvpSettlementSession,
  recordBaselIvCapitalAdequacySnapshot,
} from './cls-pvp-persistence';

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
    await recordClsPvpSettlementSession(params.session, params.request, result);

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

    await recordBaselIvCapitalAdequacySnapshot(snapshot);

    return { success: true, snapshot };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
