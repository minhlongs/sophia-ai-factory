'use server';

/**
 * @file galactic-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Galactic-RTGS quantum clearing, fractal netting, and Basel VIII audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeFractalMultilateralNetting,
  validateGalacticRtgsPayment,
  type FractalMultilateralNettingResult,
  type GalacticRtgsValidationInput,
  type GalacticRtgsValidationOutput,
} from '@/tree/clearing/galactic-rtgs-clearing-engine';
import {
  evaluateBaselViiiSolvency,
  type BaselViiiSolvencyInput,
  type BaselViiiSolvencyOutput,
} from '@/tree/reserve/basel-viii-solvency-engine';
import type {
  FractalNettingObligation,
  GalacticRtgsCurrency,
} from '@/seed/types/galactic-rtgs-capital';

export interface GalacticRtgsActionResult {
  success: boolean;
  data?: GalacticRtgsValidationOutput;
  error?: string;
}

export interface FractalNettingActionResult {
  success: boolean;
  data?: FractalMultilateralNettingResult;
  error?: string;
}

export interface BaselViiiActionResult {
  success: boolean;
  data?: BaselViiiSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist Galactic-RTGS clearing transaction.
 */
export async function processGalacticRtgsPaymentAction(
  params: GalacticRtgsValidationInput
): Promise<GalacticRtgsActionResult> {
  try {
    const data = validateGalacticRtgsPayment(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO galactic_rtgs_clearing_sessions (
             id, session_ref, source_participant_id, target_participant_id,
             asset_currency, gross_amount_cents, priority_tier, settlement_status,
             execution_latency_nanos, clearing_receipt_hash, settled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `GRTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          params.sourceParticipantId,
          params.targetParticipantId,
          params.assetCurrency,
          params.grossAmountCents,
          params.priorityTier ?? 'QUANTUM_EXPEDITE',
          data.status,
          data.executionLatencyNanos,
          data.receiptHash
        )
        .run();
    }

    return { success: data.valid, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Galactic-RTGS payment failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to execute and record Fractal Multilateral Netting 4.0.
 */
export async function executeFractalNettingBatchAction(
  obligations: FractalNettingObligation[],
  currency: GalacticRtgsCurrency = 'USDT',
  shardCount: number = 256
): Promise<FractalNettingActionResult> {
  try {
    const data = executeFractalMultilateralNetting(obligations, currency, shardCount);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO fractal_multilateral_netting_batches (
             id, batch_ref, hierarchical_shard_count, gross_flow_count,
             gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
             netting_status, fractal_solution_hash, executed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `FRACTAL-NET-${Date.now()}`,
          data.hierarchicalShardCount,
          data.grossFlowCount,
          data.grossVolumeCents,
          data.netSettlementVolumeCents,
          data.compressionRatioPct,
          data.status,
          data.fractalSolutionHash
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fractal netting failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to evaluate and record Basel VIII Solvency snapshot.
 */
export async function auditBaselViiiSolvencyAction(
  params: BaselViiiSolvencyInput
): Promise<BaselViiiActionResult> {
  try {
    const data = evaluateBaselViiiSolvency(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO basel_viii_solvency_snapshots (
             id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
             cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
             liquidity_coverage_ratio_bps, available_stable_funding_cents,
             required_stable_funding_cents, net_stable_funding_ratio_bps,
             sovereign_planetary_capital_buffer_cents, stress_test_survival_days,
             is_basel_viii_compliant, supervisory_signature
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `BASEL8-${Date.now()}`,
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
    const message = err instanceof Error ? err.message : 'Basel VIII audit failed';
    return { success: false, error: message };
  }
}
