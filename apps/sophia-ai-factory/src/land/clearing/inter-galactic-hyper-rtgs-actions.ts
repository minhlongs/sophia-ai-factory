'use server';

/**
 * @file inter-galactic-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Inter-Galactic Hyper-RTGS settlement, Netting 14.0, and Basel XVIII Solvency audits.
 */

import {
  executeInterGalacticNetting,
  validateInterGalacticHyperRtgsPayment,
  type InterGalacticNettingExecutionResult,
  type InterGalacticRtgsValidationInput,
  type InterGalacticRtgsValidationOutput,
} from '@/tree/clearing/inter-galactic-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXviiiSolvency,
  type BaselXviiiSolvencyInput,
  type BaselXviiiSolvencyOutput,
} from '@/tree/reserve/basel-xviii-solvency-engine';
import type {
  InterGalacticCurrency,
  InterGalacticNettingObligation,
} from '@/seed/types/inter-galactic-hyper-rtgs-capital';
import {
  insertHyperRtgsSessionRow,
  insertHyperNettingBatchRow,
  insertBaselSolvencyAuditRow,
} from './hyper-rtgs-persistence-helpers';

export interface InterGalacticRtgsActionResult {
  success: boolean;
  data?: InterGalacticRtgsValidationOutput;
  error?: string;
}

export interface InterGalacticNettingActionResult {
  success: boolean;
  data?: InterGalacticNettingExecutionResult;
  error?: string;
}

export interface BaselXviiiSolvencyActionResult {
  success: boolean;
  data?: BaselXviiiSolvencyOutput;
  error?: string;
}

export async function settleInterGalacticRtgsAction(
  input: InterGalacticRtgsValidationInput,
): Promise<InterGalacticRtgsActionResult> {
  try {
    const data = validateInterGalacticHyperRtgsPayment(input);
    await insertHyperRtgsSessionRow(
      'inter_galactic_hyper_rtgs_clearing_sessions',
      `IG-RTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      input,
      'INTER_GALACTIC_EXPEDITE',
      data,
    );
    return { success: data.valid, data, error: data.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to settle Inter-Galactic Hyper-RTGS payment',
    };
  }
}

export async function executeInterGalacticNettingBatchAction(
  obligations: InterGalacticNettingObligation[],
  currency: InterGalacticCurrency = 'USDT',
  hyperShardCount: number = 2097152,
): Promise<InterGalacticNettingActionResult> {
  try {
    const data = executeInterGalacticNetting(obligations, currency, hyperShardCount);
    await insertHyperNettingBatchRow('inter_galactic_netting_batches', data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Inter-Galactic netting batch',
    };
  }
}

export async function auditBaselXviiiSolvencyAction(
  input: BaselXviiiSolvencyInput,
): Promise<BaselXviiiSolvencyActionResult> {
  try {
    const data = evaluateBaselXviiiSolvency(input);
    await insertBaselSolvencyAuditRow(
      'basel_xviii_solvency_audits',
      `BASEL-XVIII-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      error: error instanceof Error ? error.message : 'Failed to audit Basel XVIII solvency',
    };
  }
}
