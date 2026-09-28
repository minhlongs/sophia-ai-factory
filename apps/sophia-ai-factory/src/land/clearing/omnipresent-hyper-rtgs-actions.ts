'use server';

/**
 * @file omnipresent-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Omnipresent Hyper-RTGS clearing, Multiverse netting, and Basel XII audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeMultiverseNetting,
  validateOmnipresentHyperRtgsPayment,
  type MultiverseNettingResult,
  type OmnipresentHyperRtgsPaymentInput,
  type OmnipresentHyperRtgsPaymentValidationResult,
} from '@/tree/clearing/omnipresent-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXiiSolvency,
  type BaselXiiSolvencyInput,
  type BaselXiiSolvencyOutput,
} from '@/tree/reserve/basel-xii-solvency-engine';
import type {
  MultiverseCurrency,
  MultiverseNettingObligation,
} from '@/seed/types/omnipresent-hyper-rtgs-capital';

export interface OmnipresentHyperRtgsActionResult {
  success: boolean;
  data?: OmnipresentHyperRtgsPaymentValidationResult;
  error?: string;
}

export interface MultiverseNettingActionResult {
  success: boolean;
  data?: MultiverseNettingResult;
  error?: string;
}

export interface BaselXiiActionResult {
  success: boolean;
  data?: BaselXiiSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist Omnipresent Hyper-RTGS clearing transaction.
 */
export async function processOmnipresentPaymentAction(
  params: OmnipresentHyperRtgsPaymentInput
): Promise<OmnipresentHyperRtgsActionResult> {
  try {
    const data = validateOmnipresentHyperRtgsPayment(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO omnipresent_hyper_rtgs_clearing_sessions (
             id, session_ref, source_participant_id, target_participant_id,
             asset_currency, gross_amount_cents, priority_tier, settlement_status,
             execution_latency_picoseconds, clearing_receipt_hash, settled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `OHRTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          params.sourceParticipantId,
          params.targetParticipantId,
          params.assetCurrency,
          params.grossAmountCents,
          params.priorityTier ?? 'OMNIPRESENT_EXPEDITE',
          data.status,
          data.executionLatencyPicoseconds,
          data.receiptHash,
          new Date().toISOString()
        )
        .run();
    }

    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Omnipresent Hyper-RTGS payment',
    };
  }
}

/**
 * Server Action to execute and persist Multiverse Multilateral Netting batch.
 */
export async function executeMultiverseNettingAction(
  obligations: MultiverseNettingObligation[],
  currency: MultiverseCurrency = 'USDT',
  shardCount: number = 32768
): Promise<MultiverseNettingActionResult> {
  try {
    const data = executeMultiverseNetting(obligations, currency, shardCount);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO multiverse_netting_batches (
             id, batch_ref, hyper_shard_count, gross_flow_count,
             gross_volume_cents, net_settlement_volume_cents, compression_ratio_pct,
             netting_status, multiverse_solution_hash, executed_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `NET-MULTI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          data.hyperShardCount,
          data.grossFlowCount,
          data.grossVolumeCents,
          data.netSettlementVolumeCents,
          data.compressionRatioPct,
          data.status,
          data.multiverseSolutionHash,
          new Date().toISOString()
        )
        .run();
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Multiverse netting batch',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XII Solvency compliance snapshot.
 */
export async function evaluateBaselXiiSolvencyAction(
  input: BaselXiiSolvencyInput
): Promise<BaselXiiActionResult> {
  try {
    const data = evaluateBaselXiiSolvency(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO basel_xii_solvency_snapshots (
             id, snapshot_ref, common_equity_tier1_cents, total_risk_exposure_cents,
             cet1_ratio_bps, high_quality_liquid_assets_cents, net_cash_outflows_30d_cents,
             liquidity_coverage_ratio_bps, available_stable_funding_cents, required_stable_funding_cents,
             net_stable_funding_ratio_bps, sovereign_capital_buffer_cents, stress_test_survival_days,
             is_basel_xii_compliant, supervisory_signature
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `BASELXII-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      error: error instanceof Error ? error.message : 'Failed to evaluate Basel XII solvency',
    };
  }
}
