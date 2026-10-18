'use server';

/**
 * @file fhe-court-actions.ts
 * @layer land/judicial
 * @description Land layer Server Actions for FHE Computation Workloads and Autonomous Court Arbitration.
 */

import { evaluateFheComputation, validateFheCircuitParams } from '@/tree/crypto/fhe-compute-engine';
import { adjudicateDisputeCase } from '@/tree/judicial/autonomous-court-engine';
import type {
  FheCiphertextWorkload,
  FheEvaluationRequest,
  FheEvaluationResult,
  JudicialDisputeCase,
  JurorBallot,
  JudicialArbitrationVerdict,
} from '@/seed/types/fhe-court';
import {
  persistFheWorkloadEvaluation,
  persistJudicialVerdict,
} from './fhe-court-persistence';

export interface SubmitFheWorkloadActionParams {
  workload: FheCiphertextWorkload;
  request: FheEvaluationRequest;
}

export interface FheActionResult {
  success: boolean;
  result?: FheEvaluationResult;
  securityLevelBits?: number;
  error?: string;
}

export async function submitFheWorkloadAction(
  params: SubmitFheWorkloadActionParams
): Promise<FheActionResult> {
  try {
    const circuitValidation = validateFheCircuitParams(
      params.workload.schemeType,
      params.workload.polynomialModulusDegree
    );

    if (!circuitValidation.valid) {
      return { success: false, error: circuitValidation.reason };
    }

    const result = evaluateFheComputation(params.workload, params.request);
    await persistFheWorkloadEvaluation(params.workload, result);

    return {
      success: true,
      result,
      securityLevelBits: circuitValidation.securityLevelBits,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface AdjudicateDisputeActionParams {
  disputeCase: JudicialDisputeCase;
  ballots: JurorBallot[];
}

export interface AdjudicateActionResult {
  success: boolean;
  verdict?: JudicialArbitrationVerdict;
  error?: string;
}

export async function adjudicateJudicialDisputeAction(
  params: AdjudicateDisputeActionParams
): Promise<AdjudicateActionResult> {
  try {
    const verdict = adjudicateDisputeCase(params.disputeCase, params.ballots);
    await persistJudicialVerdict(verdict);

    return { success: true, verdict };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
