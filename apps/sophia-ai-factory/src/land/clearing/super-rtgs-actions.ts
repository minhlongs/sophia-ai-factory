'use server';

/**
 * @file super-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Super-RTGS payment processing, parallel netting, and Basel VI audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeParallelMultilateralNetting,
  validateSuperRtgsPayment,
  type ParallelMultilateralNettingResult,
  type SuperRtgsValidationInput,
  type SuperRtgsValidationOutput,
} from '@/tree/clearing/super-rtgs-clearing-engine';
import {
  evaluateBaselViSolvency,
  type BaselViSolvencyInput,
  type BaselViSolvencyOutput,
} from '@/tree/reserve/basel-vi-solvency-engine';
import type {
  ParallelNettingObligation,
  SuperRtgsCurrency,
} from '@/seed/types/super-rtgs-capital';

export interface SuperRtgsActionResult {
  success: boolean;
  data?: SuperRtgsValidationOutput;
  error?: string;
}

export interface ParallelNettingActionResult {
  success: boolean;
  data?: ParallelMultilateralNettingResult;
  error?: string;
}

export interface BaselViActionResult {
  success: boolean;
  data?: BaselViSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist Super-RTGS clearing transaction.
 */
export async function processSuperRtgsPaymentAction(
  params: SuperRtgsValidationInput
): Promise<SuperRtgsActionResult> {
  try {
    const data = validateSuperRtgsPayment(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO super_rtgs_clearing_sessions (
             id, session_ref, source_participant_id, target_participant_id,
             asset_currency, gross_amount_cents, priority_tier, settlement_status,
             execution_latency_nanos, clearing_receipt_hash, settled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `srtgs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          `SRTGS_${params.sourceParticipantId}_${Date.now()}`,
          params.sourceParticipantId,
          params.targetParticipantId,
          params.assetCurrency,
          params.grossAmountCents,
          params.priorityTier ?? 'STANDARD_COMMERCIAL',
          data.status,
          data.executionLatencyNanos,
          data.receiptHash,
          data.valid ? new Date().toISOString() : null
        )
        .run();
    }

    return { success: data.valid, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Super-RTGS clearing failure',
    };
  }
}

/**
 * Server Action to execute parallelized multilateral netting cycle.
 */
export async function executeParallelNettingAction(
  obligations: ParallelNettingObligation[],
  defaultCurrency: SuperRtgsCurrency = 'SSDR',
  partitionCount: number = 16
): Promise<ParallelNettingActionResult> {
  try {
    const data = executeParallelMultilateralNetting(obligations, defaultCurrency, partitionCount);
    const db = await getD1();

    if (db) {
      const batchRef = `PAR_NET_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO parallel_multilateral_netting_batches (
             id, batch_ref, parallel_partition_count, gross_flow_count,
             gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
             participant_count, netting_status, graph_solution_hash, executed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `pbatch_${Date.now()}`,
          batchRef,
          data.parallelPartitionCount,
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
      error: err instanceof Error ? err.message : 'Unknown parallel netting failure',
    };
  }
}

/**
 * Server Action to audit global capital adequacy against Basel VI standards.
 */
export async function auditBaselViSolvencyAction(
  params: BaselViSolvencyInput,
  auditCycle: string = `BASEL_VI_${Date.now()}`
): Promise<BaselViActionResult> {
  try {
    const data = evaluateBaselViSolvency(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO basel_vi_solvency_snapshots (
             id, audit_cycle, common_equity_tier_1_cents, total_risk_exposure_cents,
             cet1_ratio_bps, liquidity_coverage_ratio_bps, net_stable_funding_ratio_bps,
             total_liquidity_buffer_cents, stress_test_survival_days, is_solvent,
             supervisory_signature
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `bvi_${Date.now()}`,
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
      error: err instanceof Error ? err.message : 'Unknown Basel VI audit failure',
    };
  }
}
