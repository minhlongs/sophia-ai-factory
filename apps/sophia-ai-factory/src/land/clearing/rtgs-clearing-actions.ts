'use server';

/**
 * @file rtgs-clearing-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for RTGS payment processing, multilateral netting, and Basel V solvency audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeMultilateralNetting,
  validateRtgsPayment,
  type MultilateralNettingResult,
  type RtgsValidationInput,
  type RtgsValidationOutput,
} from '@/tree/clearing/rtgs-clearing-engine';
import {
  evaluateBaselVSolvency,
  type BaselVSolvencyInput,
  type BaselVSolvencyOutput,
} from '@/tree/reserve/basel-v-solvency-engine';
import type { NettingObligation, OmniversalCurrency } from '@/seed/types/omniversal-clearing';

export interface RtgsActionResult {
  success: boolean;
  data?: RtgsValidationOutput;
  error?: string;
}

export interface NettingActionResult {
  success: boolean;
  data?: MultilateralNettingResult;
  error?: string;
}

export interface BaselVActionResult {
  success: boolean;
  data?: BaselVSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist RTGS clearing transaction.
 */
export async function processRtgsPaymentAction(
  params: RtgsValidationInput
): Promise<RtgsActionResult> {
  try {
    const data = validateRtgsPayment(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO rtgs_clearing_sessions (
             id, session_ref, source_participant_id, target_participant_id,
             asset_currency, gross_amount_cents, priority_tier, settlement_status,
             execution_latency_micros, clearing_receipt_hash, settled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `rtgs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          `RTGS_${params.sourceParticipantId}_${Date.now()}`,
          params.sourceParticipantId,
          params.targetParticipantId,
          params.assetCurrency,
          params.grossAmountCents,
          params.priorityTier ?? 'STANDARD_COMMERCIAL',
          data.status,
          45,
          data.receiptHash,
          data.valid ? new Date().toISOString() : null
        )
        .run();
    }

    return { success: data.valid, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown RTGS clearing failure',
    };
  }
}

/**
 * Server Action to execute multilateral netting cycle across participant obligations.
 */
export async function executeNettingCycleAction(
  obligations: NettingObligation[],
  defaultCurrency: OmniversalCurrency = 'SSDR'
): Promise<NettingActionResult> {
  try {
    const data = executeMultilateralNetting(obligations, defaultCurrency);
    const db = await getD1();

    if (db) {
      const batchRef = `NET_CYCLE_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO multilateral_netting_batches (
             id, batch_ref, cycle_interval_seconds, gross_flow_count,
             gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
             participant_count, netting_status, graph_solution_hash, executed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `batch_${Date.now()}`,
          batchRef,
          60,
          data.grossFlowCount,
          data.grossVolumeCents,
          data.netSettlementVolumeCents,
          data.compressionRatioPct,
          Object.keys(data.netPositions).length,
          data.status,
          data.graphSolutionHash,
          new Date().toISOString()
        )
        .run();
    }

    return { success: data.status === 'NET_EXECUTED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown netting cycle failure',
    };
  }
}

/**
 * Server Action to audit global capital adequacy against Basel V requirements.
 */
export async function auditBaselVSolvencyAction(
  params: BaselVSolvencyInput,
  auditCycle: string = `AUDIT_${Date.now()}`
): Promise<BaselVActionResult> {
  try {
    const data = evaluateBaselVSolvency(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO basel_v_solvency_snapshots (
             id, audit_cycle, common_equity_tier_1_cents, total_risk_exposure_cents,
             cet1_ratio_bps, liquidity_coverage_ratio_bps, net_stable_funding_ratio_bps,
             total_liquidity_buffer_cents, stress_test_survival_days, is_solvent,
             supervisory_signature
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `bv_${Date.now()}`,
          auditCycle,
          params.commonEquityTier1Cents,
          params.totalRiskExposureCents,
          data.cet1RatioBps,
          data.liquidityCoverageRatioBps,
          data.netStableFundingRatioBps,
          data.totalLiquidityBufferCents,
          data.stressTestSurvivalDays,
          data.isSolvent ? 1 : 0,
          data.supervisorySignature
        )
        .run();
    }

    return { success: data.isSolvent, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Basel V audit failure',
    };
  }
}
