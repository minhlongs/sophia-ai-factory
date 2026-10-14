'use server';

/**
 * @file pan-dimensional-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Pan-Dimensional Hyper-RTGS settlement, Netting 15.0, and Basel XIX Solvency audits.
 */

import {
  executePanDimensionalNetting,
  validatePanDimensionalHyperRtgsPayment,
  type PanDimensionalNettingExecutionResult,
  type PanDimensionalRtgsValidationInput,
  type PanDimensionalRtgsValidationOutput,
} from '@/tree/clearing/pan-dimensional-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXixSolvency,
  type BaselXixSolvencyInput,
  type BaselXixSolvencyOutput,
} from '@/tree/reserve/basel-xix-solvency-engine';
import type {
  PanDimensionalCurrency,
  PanDimensionalNettingObligation,
} from '@/seed/types/pan-dimensional-hyper-rtgs-capital';
import {
  insertHyperRtgsSessionRow,
  insertHyperNettingBatchRow,
  insertBaselSolvencyAuditRow,
} from './hyper-rtgs-persistence-helpers';

export interface PanDimensionalRtgsActionResult {
  success: boolean;
  data?: PanDimensionalRtgsValidationOutput;
  error?: string;
}

export interface PanDimensionalNettingActionResult {
  success: boolean;
  data?: PanDimensionalNettingExecutionResult;
  error?: string;
}

export interface BaselXixSolvencyActionResult {
  success: boolean;
  data?: BaselXixSolvencyOutput;
  error?: string;
}

export async function settlePanDimensionalRtgsAction(
  input: PanDimensionalRtgsValidationInput,
): Promise<PanDimensionalRtgsActionResult> {
  try {
    const data = validatePanDimensionalHyperRtgsPayment(input);
    await insertHyperRtgsSessionRow(
      'pan_dimensional_hyper_rtgs_clearing_sessions',
      `PAN-RTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      input,
      'PAN_DIMENSIONAL_EXPEDITE',
      data,
    );
    return { success: data.valid, data, error: data.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to settle Pan-Dimensional Hyper-RTGS payment',
    };
  }
}

export async function executePanDimensionalNettingBatchAction(
  obligations: PanDimensionalNettingObligation[],
  currency: PanDimensionalCurrency = 'PAN_DIMENSIONAL_CREDIT',
  hyperShardCount: number = 4194304,
): Promise<PanDimensionalNettingActionResult> {
  try {
    const data = executePanDimensionalNetting(obligations, currency, hyperShardCount);
    await insertHyperNettingBatchRow('pan_dimensional_netting_batches', data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Pan-Dimensional netting batch',
    };
  }
}

export async function auditBaselXixSolvencyAction(
  input: BaselXixSolvencyInput,
): Promise<BaselXixSolvencyActionResult> {
  try {
    const data = evaluateBaselXixSolvency(input);
    await insertBaselSolvencyAuditRow(
      'basel_xix_solvency_audits',
      `BASEL-XIX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      {
        commonEquityTier1Cents: input.commonEquityTier1Cents,
        totalRiskExposureCents: input.totalRiskExposureCents,
        highQualityLiquidAssetsCents: input.highQualityLiquidAssetsCents,
        netCashOutflows30DaysCents: input.netCashOutflows30DaysCents,
        availableStableFundingCents: input.availableStableFundingCents,
        requiredStableFundingCents: input.requiredStableFundingCents,
        sovereignCapitalBufferCents: input.sovereignCapitalBufferCents,
        stressTestSurvivalDays: input.stressTestSurvivalDays,
        cet1RatioBps: data.cet1RatioBps,
        liquidityCoverageRatioBps: data.liquidityCoverageRatioBps,
        netStableFundingRatioBps: data.netStableFundingRatioBps,
        solvencyStatus: data.solvencyStatus,
        supervisorySignature: data.supervisorySignature,
      },
    );
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to audit Basel XIX solvency',
    };
  }
}
