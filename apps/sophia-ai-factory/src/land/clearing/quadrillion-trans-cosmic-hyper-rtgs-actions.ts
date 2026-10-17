'use server';

/**
 * @file quadrillion-trans-cosmic-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Quadrillion Trans-Cosmic Hyper-RTGS settlement, Netting 18.0, and Basel XXII Solvency audits.
 */

import {
  recordHyperRtgsNettingBatch,
  recordHyperRtgsSession,
  recordHyperRtgsSolvencyAudit,
} from '@/land/clearing/hyper-rtgs-d1-recorder';
import {
  executeQuadrillionMultiverseNetting,
  validateQuadrillionTransCosmicHyperRtgsPayment,
  type QuadrillionNettingExecutionResult,
  type QuadrillionRtgsValidationInput,
  type QuadrillionRtgsValidationOutput,
} from '@/tree/clearing/quadrillion-trans-cosmic-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXxiiSolvency,
  type BaselXxiiSolvencyInput,
  type BaselXxiiSolvencyOutput,
} from '@/tree/reserve/basel-xxii-solvency-engine';
import type {
  QuadrillionTransCosmicCurrency,
  QuadrillionNettingObligation,
} from '@/seed/types/quadrillion-trans-cosmic-hyper-rtgs-capital';

export interface QuadrillionRtgsActionResult {
  success: boolean;
  data?: QuadrillionRtgsValidationOutput;
  error?: string;
}

export interface QuadrillionNettingActionResult {
  success: boolean;
  data?: QuadrillionNettingExecutionResult;
  error?: string;
}

export interface BaselXxiiSolvencyActionResult {
  success: boolean;
  data?: BaselXxiiSolvencyOutput;
  error?: string;
}

export async function settleQuadrillionRtgsAction(
  input: QuadrillionRtgsValidationInput
): Promise<QuadrillionRtgsActionResult> {
  try {
    const data = validateQuadrillionTransCosmicHyperRtgsPayment(input);
    await recordHyperRtgsSession({
      tablePrefix: 'quadrillion_trans_cosmic',
      sessionRefPrefix: 'QUAD-RTGS',
      sourceParticipantId: input.sourceParticipantId,
      targetParticipantId: input.targetParticipantId,
      assetCurrency: input.assetCurrency,
      grossAmountCents: input.grossAmountCents,
      priorityTier: input.priorityTier ?? 'QUADRILLION_SOVEREIGN_EXPEDITE',
      status: data.status,
      executionLatencyPicoseconds: data.executionLatencyPicoseconds,
      receiptHash: data.receiptHash,
    });
    return { success: data.valid, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeQuadrillionNettingAction(
  obligations: QuadrillionNettingObligation[],
  currency: QuadrillionTransCosmicCurrency = 'QUADRILLION_TRANS_COSMIC_CREDIT',
  hyperShardCount: number = 33554432
): Promise<QuadrillionNettingActionResult> {
  try {
    const data = executeQuadrillionMultiverseNetting(obligations, currency, hyperShardCount);
    await recordHyperRtgsNettingBatch('quadrillion_trans_cosmic', data);
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function auditBaselXxiiSolvencyAction(
  input: BaselXxiiSolvencyInput
): Promise<BaselXxiiSolvencyActionResult> {
  try {
    const data = evaluateBaselXxiiSolvency(input);
    await recordHyperRtgsSolvencyAudit({
      tableName: 'basel_xxii_solvency_audits',
      auditRefPrefix: 'BASEL-XXII-AUDIT',
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
