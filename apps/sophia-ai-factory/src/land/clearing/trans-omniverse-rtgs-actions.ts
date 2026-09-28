'use server';

/**
 * @file trans-omniverse-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Trans-Omniverse RTGS clearing, Trans-Cosmic netting, and Basel X audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeTransCosmicNetting,
  validateTransOmniverseRtgsPayment,
  type TransCosmicNettingResult,
  type TransOmniverseRtgsPaymentInput,
  type TransOmniverseRtgsPaymentValidationResult,
} from '@/tree/clearing/trans-omniverse-rtgs-clearing-engine';
import {
  evaluateBaselXSolvency,
  type BaselXSolvencyInput,
  type BaselXSolvencyOutput,
} from '@/tree/reserve/basel-x-solvency-engine';
import type {
  TransCosmicNettingObligation,
  TransOmniverseCurrency,
} from '@/seed/types/trans-omniverse-rtgs-capital';

export interface TransOmniverseRtgsActionResult {
  success: boolean;
  data?: TransOmniverseRtgsPaymentValidationResult;
  error?: string;
}

export interface TransCosmicNettingActionResult {
  success: boolean;
  data?: TransCosmicNettingResult;
  error?: string;
}

export interface BaselXActionResult {
  success: boolean;
  data?: BaselXSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist Trans-Omniverse RTGS clearing transaction.
 */
export async function processTransOmniversePaymentAction(
  params: TransOmniverseRtgsPaymentInput
): Promise<TransOmniverseRtgsActionResult> {
  try {
    const data = validateTransOmniverseRtgsPayment(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO trans_omniverse_rtgs_clearing_sessions (
             id, session_ref, source_participant_id, target_participant_id,
             asset_currency, gross_amount_cents, priority_tier, settlement_status,
             execution_latency_nanos, clearing_receipt_hash, settled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `TORTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          params.sourceParticipantId,
          params.targetParticipantId,
          params.assetCurrency,
          params.grossAmountCents,
          params.priorityTier ?? 'SUB_PLANCK_EXPEDITE',
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
      error: error instanceof Error ? error.message : 'Failed to process Trans-Omniverse RTGS payment',
    };
  }
}

/**
 * Server Action to execute and persist Trans-Cosmic Multilateral Netting batch.
 */
export async function executeTransCosmicNettingAction(
  obligations: TransCosmicNettingObligation[],
  currency: TransOmniverseCurrency = 'USDT',
  shardCount: number = 4096
): Promise<TransCosmicNettingActionResult> {
  try {
    const data = executeTransCosmicNetting(obligations, currency, shardCount);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO trans_cosmic_netting_batches (
             id, batch_ref, hyper_shard_count, gross_flow_count,
             gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
             netting_status, trans_cosmic_solution_hash, executed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `NET-COSMIC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          data.hyperShardCount,
          data.grossFlowCount,
          data.grossVolumeCents,
          data.netSettlementVolumeCents,
          data.compressionRatioPct,
          data.status,
          data.transCosmicSolutionHash,
          new Date().toISOString()
        )
        .run();
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Trans-Cosmic netting batch',
    };
  }
}

/**
 * Server Action to evaluate and record Basel X Solvency compliance snapshot.
 */
export async function evaluateBaselXSolvencyAction(
  input: BaselXSolvencyInput
): Promise<BaselXActionResult> {
  try {
    const data = evaluateBaselXSolvency(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO basel_x_solvency_snapshots (
             id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
             cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
             liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
             net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
             is_basel_x_compliant, supervisory_signature
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `BASELX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      error: error instanceof Error ? error.message : 'Failed to evaluate Basel X solvency',
    };
  }
}
