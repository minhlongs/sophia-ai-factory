'use server';

/**
 * @file fhe-court-actions.ts
 * @layer land/judicial
 * @description Land layer Server Actions for FHE Computation Workloads and Autonomous Court Arbitration.
 */

import { getD1 } from '@/seed/db/client';
import { evaluateFheComputation, validateFheCircuitParams } from '@/tree/crypto/fhe-compute-engine';
import { adjudicateDisputeCase, validateAppealEligibility } from '@/tree/judicial/autonomous-court-engine';
import type {
  FheCiphertextWorkload,
  FheEvaluationRequest,
  FheEvaluationResult,
  JudicialDisputeCase,
  JurorBallot,
  JudicialArbitrationVerdict,
} from '@/seed/types/fhe-court';

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
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO fhe_ciphertext_workloads (
             id, workload_id, scheme_type, ciphertext_digest_sha256,
             polynomial_modulus_degree, current_noise_budget_bits,
             min_noise_budget_threshold, requires_bootstrapping,
             status, execution_duration_ms
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(workload_id) DO UPDATE SET
             current_noise_budget_bits = ?,
             execution_duration_ms = execution_duration_ms + ?`
        )
        .bind(
          `fhe_${params.workload.workloadId}`,
          params.workload.workloadId,
          params.workload.schemeType,
          result.resultCiphertextDigest,
          params.workload.polynomialModulusDegree,
          result.remainingNoiseBudgetBits,
          params.workload.minNoiseBudgetThreshold,
          result.bootstrappingTriggered ? 1 : 0,
          'EVALUATED_READY',
          result.durationMs,
          result.remainingNoiseBudgetBits,
          result.durationMs
        )
        .run();
    }

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
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO judicial_arbitration_verdicts (
             id, case_number, verdict_outcome, affirmative_votes, dissenting_votes,
             slashed_juror_stakes_cents, disbursed_compensation_cents,
             zero_knowledge_proof_hash, formal_verification_passed
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          verdict.id,
          verdict.caseNumber,
          verdict.verdictOutcome,
          verdict.affirmativeVotes,
          verdict.dissentingVotes,
          verdict.slashedJurorStakesCents,
          verdict.disbursedCompensationCents,
          verdict.zeroKnowledgeProofHash,
          verdict.formalVerificationPassed ? 1 : 0
        )
        .run();

      await db
        .prepare(
          `UPDATE judicial_dispute_cases
           SET status = ?
           WHERE case_number = ?`
        )
        .bind('VERDICT_RENDERED', verdict.caseNumber)
        .run();
    }

    return { success: true, verdict };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
