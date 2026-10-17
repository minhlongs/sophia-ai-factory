'use server';

/**
 * @file biquadrillion-trans-cosmic-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Bi-Quadrillion Hyper-RTGS settlement, Netting 19.0, and Basel XXIII Solvency audits.
 */

import {
  recordHyperRtgsNettingBatch,
  recordHyperRtgsSession,
  recordHyperRtgsSolvencyAudit,
} from '@/land/clearing/hyper-rtgs-d1-recorder';
import {
  executeBiquadrillionMultiverseNetting,
  validateBiquadrillionHyperRtgsPayment,
  type BiquadrillionNettingExecutionResult,
  type BiquadrillionRtgsValidationInput,
  type BiquadrillionRtgsValidationOutput,
} from '@/tree/clearing/biquadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXxiiiSolvency,
  type BaselXxiiiSolvencyInput,
  type BaselXxiiiSolvencyOutput,
} from '@/tree/reserve/basel-xxiii-solvency-engine';
import type {
  BiquadrillionCurrency,
  BiquadrillionNettingObligation,
} from '@/seed/types/biquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BiquadrillionRtgsActionResult {
  success: boolean;
  data?: BiquadrillionRtgsValidationOutput;
  error?: string;
}

export interface BiquadrillionNettingActionResult {
  success: boolean;
  data?: BiquadrillionNettingExecutionResult;
  error?: string;
}

export interface BaselXxiiiSolvencyActionResult {
  success: boolean;
  data?: BaselXxiiiSolvencyOutput;
  error?: string;
}

export async function settleBiquadrillionRtgsAction(
  input: BiquadrillionRtgsValidationInput
): Promise<BiquadrillionRtgsActionResult> {
  try {
    const data = validateBiquadrillionHyperRtgsPayment(input);
    await recordHyperRtgsSession({
      tablePrefix: 'biquadrillion',
      sessionRefPrefix: 'BIQUAD-RTGS',
      sourceParticipantId: input.sourceParticipantId,
      targetParticipantId: input.targetParticipantId,
      assetCurrency: input.assetCurrency,
      grossAmountCents: input.grossAmountCents,
      priorityTier: input.priorityTier ?? 'BIQUADRILLION_SOVEREIGN_EXPEDITE',
      status: data.status,
      executionLatencyPicoseconds: data.executionLatencyPicoseconds,
      receiptHash: data.receiptHash,
    });
    return { success: data.valid, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeBiquadrillionNettingAction(
  obligations: BiquadrillionNettingObligation[],
  currency: BiquadrillionCurrency = 'BIQUADRILLION_TRANS_COSMIC_CREDIT',
  hyperShardCount: number = 67108864
): Promise<BiquadrillionNettingActionResult> {
  try {
    const data = executeBiquadrillionMultiverseNetting(obligations, currency, hyperShardCount);
    await recordHyperRtgsNettingBatch('biquadrillion', data);
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function auditBaselXxiiiSolvencyAction(
  input: BaselXxiiiSolvencyInput
): Promise<BaselXxiiiSolvencyActionResult> {
  try {
    const data = evaluateBaselXxiiiSolvency(input);
    await recordHyperRtgsSolvencyAudit({
      tableName: 'basel_xxiii_solvency_audits',
      auditRefPrefix: 'BASEL-XXIII-AUDIT',
      ...input,
      cet1RatioBps: data.cet1RatioBps,
      liquidityCoverageRatioBps: data.liquidityCoverageRatioBps,
      netStableFundingRatioBps: data.netStableFundingRatioBps,
      solvencyStatus: data.solvencyStatus,
      supervisorySignature: data.supervisorySignature,
      hqlaColumnName: 'high_quality_liquid_assets_cents',
    });
    return { success: data.isSolvent, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
