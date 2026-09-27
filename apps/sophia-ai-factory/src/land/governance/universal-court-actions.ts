'use server';

/**
 * @file universal-court-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for zk-STARK state compaction and Universal Constitutional Court arbitration.
 */

import { getD1 } from '@/seed/db/client';
import {
  compactStateWithZkStark,
  type ZkStarkCompactionResult,
} from '@/tree/crypto/zk-stark-compaction-engine';
import {
  arbitrateUniversalDispute,
  verifyUniversalConstitutionalInvariants,
  type UniversalCourtVerdictOutput,
  type UniversalDisputeInput,
  type UniversalInvariantCheckOutput,
} from '@/tree/governance/universal-court-engine';
import type {
  StarkTransaction,
  UniversalConstitutionalInvariant,
} from '@/seed/types/zk-stark-constitution';

export interface ZkStarkCompactActionResult {
  success: boolean;
  data?: ZkStarkCompactionResult;
  error?: string;
}

export interface UniversalCourtActionResult {
  success: boolean;
  data?: UniversalCourtVerdictOutput;
  error?: string;
}

export interface UniversalInvariantActionResult {
  success: boolean;
  data?: UniversalInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to compact 2,000,000 transactions into a 64-byte STARK root and record proof.
 */
export async function compactZkStarkStateAction(
  previousStateRoot: string,
  transactions: StarkTransaction[],
  proofRef: string = `STARK_PROOF_${Date.now()}`
): Promise<ZkStarkCompactActionResult> {
  try {
    const data = compactStateWithZkStark(previousStateRoot, transactions);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO zk_stark_compaction_proofs (
             id, proof_ref, batch_transaction_count, previous_state_root,
             new_state_root, stark_proof_bytes_length, verification_time_micros,
             verifier_circuit_identifier, is_mathematically_sound
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `stark_${Date.now()}`,
          proofRef,
          data.batchTransactionCount,
          data.previousStateRoot,
          data.newStateRoot,
          data.starkProofBytesLength,
          data.verificationTimeMicros,
          data.verifierCircuitIdentifier,
          data.isMathematicallySound ? 1 : 0
        )
        .run();
    }

    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown zk-STARK compaction failure',
    };
  }
}

/**
 * Server Action to arbitrate disputes before the Universal Supreme Court and persist ruling.
 */
export async function arbitrateUniversalDisputeAction(
  params: UniversalDisputeInput
): Promise<UniversalCourtActionResult> {
  try {
    const data = arbitrateUniversalDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO universal_court_arbitrations (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, contract_stark_root, evidence_sha256,
             juror_count, supermajority_threshold_pct, verdict,
             jurors_slashed_count, executed_remedy_cents, resolved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `ucourt_${Date.now()}`,
          params.disputeCaseRef,
          params.claimantParticipantId,
          params.respondentParticipantId,
          params.disputeValueCents,
          'STARK_CONTRACT_ROOT_PLACEHOLDER',
          params.evidenceSha256,
          data.totalJurors,
          params.supermajorityThresholdPct ?? 80.0,
          data.verdict,
          data.jurorsSlashedCount,
          data.executedRemedyCents,
          data.verdict !== 'DELIBERATING' ? new Date().toISOString() : null
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown universal court failure',
    };
  }
}

/**
 * Server Action to verify universal constitutional immutability.
 */
export async function verifyUniversalInvariantAction(
  invariants: UniversalConstitutionalInvariant[],
  articleCode: string
): Promise<UniversalInvariantActionResult> {
  try {
    const data = verifyUniversalConstitutionalInvariants(invariants, articleCode);
    return { success: data.allowed, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown universal invariant failure',
    };
  }
}
