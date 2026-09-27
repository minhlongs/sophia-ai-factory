'use server';

/**
 * @file hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Hyper-RTGS warp clearing, distributed netting, and Basel VII audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeDistributedMultilateralNetting,
  validateHyperRtgsPayment,
  type DistributedMultilateralNettingResult,
  type HyperRtgsValidationInput,
  type HyperRtgsValidationOutput,
} from '@/tree/clearing/hyper-rtgs-clearing-engine';
import {
  evaluateBaselViiSolvency,
  type BaselViiSolvencyInput,
  type BaselViiSolvencyOutput,
} from '@/tree/reserve/basel-vii-solvency-engine';
import type {
  DistributedNettingObligation,
  HyperRtgsCurrency,
} from '@/seed/types/hyper-rtgs-capital';

export interface HyperRtgsActionResult {
  success: boolean;
  data?: HyperRtgsValidationOutput;
  error?: string;
}

export interface DistributedNettingActionResult {
  success: boolean;
  data?: DistributedMultilateralNettingResult;
  error?: string;
}

export interface BaselViiActionResult {
  success: boolean;
  data?: BaselViiSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist Hyper-RTGS clearing transaction.
 */
export async function processHyperRtgsPaymentAction(
  params: HyperRtgsValidationInput
): Promise<HyperRtgsActionResult> {
  try {
    const data = validateHyperRtgsPayment(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO hyper_rtgs_clearing_sessions (
             id, session_ref, source_participant_id, target_participant_id,
             asset_currency, gross_amount_cents, priority_tier, settlement_status,
             execution_latency_nanos, clearing_receipt_hash, settled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `hrtgs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          `HRTGS_${params.sourceParticipantId}_${Date.now()}`,
          params.sourceParticipantId,
          params.targetParticipantId,
          params.assetCurrency,
          params.grossAmountCents,
          params.priorityTier ?? 'WARP_EXPEDITE',
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
      error: err instanceof Error ? err.message : 'Unknown Hyper-RTGS clearing failure',
    };
  }
}

/**
 * Server Action to execute distributed multilateral netting cycle.
 */
export async function executeDistributedNettingAction(
  obligations: DistributedNettingObligation[],
  defaultCurrency: HyperRtgsCurrency = 'USDT',
  partitionCount: number = 64
): Promise<DistributedNettingActionResult> {
  try {
    const data = executeDistributedMultilateralNetting(obligations, defaultCurrency, partitionCount);
    const db = await getD1();

    if (db) {
      const batchRef = `DIST_NET_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO distributed_multilateral_netting_batches (
             id, batch_ref, network_partition_count, gross_flow_count,
             gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
             netting_status, graph_solution_hash, executed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `dbatch_${Date.now()}`,
          batchRef,
          data.networkPartitionCount,
          data.grossFlowCount,
          data.grossVolumeCents,
          data.netSettlementVolumeCents,
          data.compressionRatioPct,
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
      error: err instanceof Error ? err.message : 'Unknown distributed netting failure',
    };
  }
}

/**
 * Server Action to audit global capital adequacy against Basel VII standards.
 */
export async function auditBaselViiSolvencyAction(
  params: BaselViiSolvencyInput,
  snapshotRef: string = `BASEL_VII_${Date.now()}`
): Promise<BaselViiActionResult> {
  try {
    const data = evaluateBaselViiSolvency(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO basel_vii_solvency_snapshots (
             id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
             cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
             liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
             net_stable_funding_ratio_bps, interstellar_capital_buffer_cents, stress_test_survival_days,
             is_basel_vii_compliant, supervisory_signature
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `bvii_${Date.now()}`,
          snapshotRef,
          params.commonEquityTier1Cents,
          params.totalRiskExposureCents,
          data.cet1RatioBps,
          params.highQualityLiquidAssetsCents,
          params.netCashOutflows30DaysCents,
          data.liquidityCoverageRatioBps,
          params.availableStableFundingCents,
          params.requiredStableFundingCents,
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
      error: err instanceof Error ? err.message : 'Unknown Basel VII audit failure',
    };
  }
}
