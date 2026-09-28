'use server';

/**
 * @file infinite-continuum-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Infinite-Continuum RTGS clearing, Continuum netting, and Basel XI audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeContinuumNetting,
  validateInfiniteContinuumRtgsPayment,
  type ContinuumNettingResult,
  type InfiniteContinuumRtgsPaymentInput,
  type InfiniteContinuumRtgsPaymentValidationResult,
} from '@/tree/clearing/infinite-continuum-rtgs-clearing-engine';
import {
  evaluateBaselXiSolvency,
  type BaselXiSolvencyInput,
  type BaselXiSolvencyOutput,
} from '@/tree/reserve/basel-xi-solvency-engine';
import type {
  ContinuumCurrency,
  ContinuumNettingObligation,
} from '@/seed/types/infinite-continuum-rtgs-capital';

export interface InfiniteContinuumRtgsActionResult {
  success: boolean;
  data?: InfiniteContinuumRtgsPaymentValidationResult;
  error?: string;
}

export interface ContinuumNettingActionResult {
  success: boolean;
  data?: ContinuumNettingResult;
  error?: string;
}

export interface BaselXiActionResult {
  success: boolean;
  data?: BaselXiSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist Infinite-Continuum RTGS clearing transaction.
 */
export async function processInfiniteContinuumPaymentAction(
  params: InfiniteContinuumRtgsPaymentInput
): Promise<InfiniteContinuumRtgsActionResult> {
  try {
    const data = validateInfiniteContinuumRtgsPayment(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO infinite_continuum_rtgs_clearing_sessions (
             id, session_ref, source_participant_id, target_participant_id,
             asset_currency, gross_amount_cents, priority_tier, settlement_status,
             execution_latency_nanos, clearing_receipt_hash, settled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `ICRTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          params.sourceParticipantId,
          params.targetParticipantId,
          params.assetCurrency,
          params.grossAmountCents,
          params.priorityTier ?? 'WARP_EXPEDITE',
          data.status,
          data.executionLatencyNanos,
          data.receiptHash,
          new Date().toISOString()
        )
        .run();
    }

    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Infinite-Continuum RTGS payment',
    };
  }
}

/**
 * Server Action to execute and persist Continuum Multilateral Netting batch.
 */
export async function executeContinuumNettingAction(
  obligations: ContinuumNettingObligation[],
  currency: ContinuumCurrency = 'USDT',
  shardCount: number = 16384
): Promise<ContinuumNettingActionResult> {
  try {
    const data = executeContinuumNetting(obligations, currency, shardCount);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO continuum_netting_batches (
             id, batch_ref, hyper_shard_count, gross_flow_count,
             gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
             netting_status, continuum_solution_hash, executed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `NET-CONT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          data.hyperShardCount,
          data.grossFlowCount,
          data.grossVolumeCents,
          data.netSettlementVolumeCents,
          data.compressionRatioPct,
          data.status,
          data.continuumSolutionHash,
          new Date().toISOString()
        )
        .run();
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Continuum netting batch',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XI Solvency compliance snapshot.
 */
export async function evaluateBaselXiSolvencyAction(
  input: BaselXiSolvencyInput
): Promise<BaselXiActionResult> {
  try {
    const data = evaluateBaselXiSolvency(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO basel_xi_solvency_snapshots (
             id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
             cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
             liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
             net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
             is_basel_xi_compliant, supervisory_signature
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `BASELXI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          input.commonEquityTier1Cents,
          input.totalRiskExposureCents,
          data.cet1RatioBps,
          input.highQualityLiquidAssetsCents,
          input.netCashOutflows30DaysCents,
          data.liquidityCoverageRatioBps,
          input.availableStableFundingCents,
          input.requiredStableFundingCents,
          data.netStableFundingRatioBps,
          input.sovereignCapitalBufferCents,
          input.stressTestSurvivalDays,
          data.isSolvent ? 1 : 0,
          data.supervisorySignature
        )
        .run();
    }

    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate Basel XI solvency',
    };
  }
}
