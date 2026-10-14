'use server';

/**
 * @file omni-cosmic-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Omni-Cosmic Hyper-RTGS settlement, Netting 13.0, and Basel XVII Solvency audits.
 */

import {
  executeOmniCosmicNetting,
  validateOmniCosmicHyperRtgsPayment,
  type OmniCosmicNettingExecutionResult,
  type OmniCosmicRtgsValidationInput,
  type OmniCosmicRtgsValidationOutput,
} from '@/tree/clearing/omni-cosmic-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXviiSolvency,
  type BaselXviiSolvencyInput,
  type BaselXviiSolvencyOutput,
} from '@/tree/reserve/basel-xvii-solvency-engine';
import type {
  OmniCosmicCurrency,
  OmniCosmicNettingObligation,
} from '@/seed/types/omni-cosmic-hyper-rtgs-capital';
import {
  insertHyperRtgsSessionRow,
  insertHyperNettingBatchRow,
  insertBaselSolvencyAuditRow,
} from './hyper-rtgs-persistence-helpers';

export interface OmniCosmicRtgsActionResult {
  success: boolean;
  data?: OmniCosmicRtgsValidationOutput;
  error?: string;
}

export interface OmniCosmicNettingActionResult {
  success: boolean;
  data?: OmniCosmicNettingExecutionResult;
  error?: string;
}

export interface BaselXviiSolvencyActionResult {
  success: boolean;
  data?: BaselXviiSolvencyOutput;
  error?: string;
}

export async function settleOmniCosmicRtgsAction(
  input: OmniCosmicRtgsValidationInput,
): Promise<OmniCosmicRtgsActionResult> {
  try {
    const data = validateOmniCosmicHyperRtgsPayment(input);
    await insertHyperRtgsSessionRow(
      'omni_cosmic_hyper_rtgs_clearing_sessions',
      `OMNI-RTGS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      input,
      'OMNI_COSMIC_EXPEDITE',
      data,
    );
    return { success: data.valid, data, error: data.error };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to settle Omni-Cosmic Hyper-RTGS payment',
    };
  }
}

export async function executeOmniCosmicNettingBatchAction(
  obligations: OmniCosmicNettingObligation[],
  currency: OmniCosmicCurrency = 'USDT',
  hyperShardCount: number = 1048576,
): Promise<OmniCosmicNettingActionResult> {
  try {
    const data = executeOmniCosmicNetting(obligations, currency, hyperShardCount);
    await insertHyperNettingBatchRow('omni_cosmic_netting_batches', data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Omni-Cosmic Netting batch',
    };
  }
}

export async function auditBaselXviiSolvencyAction(
  input: BaselXviiSolvencyInput,
): Promise<BaselXviiSolvencyActionResult> {
  try {
    const data = evaluateBaselXviiSolvency(input);
    await insertBaselSolvencyAuditRow(
      'basel_xvii_solvency_audits',
      `AUDIT-BASEL-XVII-${Date.now()}`,
      {
        commonEquityTier1Cents: input.commonEquityTier1Cents,
        totalRiskExposureCents: input.totalRiskExposureCents,
        highQualityLiquidAssetsCents: input.highQualityLiquidAssetsCents,
        netCashOutflows30DaysCents: input.netCashOutflows30DaysCents,
        availableStableFundingCents: input.availableStableFundingCents,
        requiredStableFundingCents: input.requiredStableFundingCents,
        sovereignCapitalBufferCents: data.sovereignCapitalBufferCents,
        stressTestSurvivalDays: data.stressTestSurvivalDays,
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
      error: error instanceof Error ? error.message : 'Failed to audit Basel XVII solvency',
    };
  }
}
