/**
 * @file fhe-court-persistence.ts
 * @layer land/judicial
 * @description D1 persistence helpers for FHE Computation Workloads and Autonomous Court Arbitration Verdicts.
 */

import { getD1 } from '@/seed/db/client';
import type {
  FheCiphertextWorkload,
  FheEvaluationResult,
  JudicialArbitrationVerdict,
} from '@/seed/types/fhe-court';

export async function persistFheWorkloadEvaluation(
  workload: FheCiphertextWorkload,
  result: FheEvaluationResult,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

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
      `fhe_${workload.workloadId}`,
      workload.workloadId,
      workload.schemeType,
      result.resultCiphertextDigest,
      workload.polynomialModulusDegree,
      result.remainingNoiseBudgetBits,
      workload.minNoiseBudgetThreshold,
      result.bootstrappingTriggered ? 1 : 0,
      'EVALUATED_READY',
      result.durationMs,
      result.remainingNoiseBudgetBits,
      result.durationMs
    )
    .run();
}

export async function persistJudicialVerdict(
  verdict: JudicialArbitrationVerdict,
): Promise<void> {
  const db = await getD1();
  if (!db) return;

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
