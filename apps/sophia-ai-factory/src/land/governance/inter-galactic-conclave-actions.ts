'use server';

/**
 * @file inter-galactic-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omni-Cosmic Conclave arbitration, constitutional invariant checks, and STARK compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateInterGalacticConclaveDispute,
  verifyInterGalacticConstitutionalInvariants,
  type InterGalacticDisputeInput,
  type InterGalacticDisputeRuling,
  type InterGalacticInvariantCheckOutput,
} from '@/tree/governance/inter-galactic-supreme-conclave-engine';
import {
  compactStateWithInterGalacticStark,
  type InterGalacticStarkCompactionResult,
} from '@/tree/crypto/inter-galactic-stark-engine';
import type {
  InterGalacticConstitutionalInvariant,
  InterGalacticTransaction,
} from '@/seed/types/inter-galactic-stark-conclave';

export interface InterGalacticDisputeActionResult {
  success: boolean;
  data?: InterGalacticDisputeRuling;
  error?: string;
}

export interface InterGalacticCompactionActionResult {
  success: boolean;
  data?: InterGalacticStarkCompactionResult;
  error?: string;
}

/**
 * Server Action to arbitrate an Inter-Galactic dispute via Supreme Conclave (99.99999% consensus).
 */
export async function arbitrateInterGalacticDisputeAction(
  input: InterGalacticDisputeInput
): Promise<InterGalacticDisputeActionResult> {
  try {
    const data = arbitrateInterGalacticConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO inter_galactic_conclave_disputes (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, evidence_sha256, total_jurors, claimant_votes,
             respondent_votes, supermajority_pct, jurors_slashed_count,
             total_slashed_stake_cents, executed_remedy_cents, verdict,
             ruling_hash, ruled_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          input.disputeCaseRef,
          input.claimantParticipantId,
          input.respondentParticipantId,
          input.disputeValueCents,
          input.evidenceSha256,
          data.totalJurors,
          data.claimantVotes,
          data.respondentVotes,
          data.effectiveSupermajorityPct,
          data.jurorsSlashedCount,
          data.totalSlashedStakeCents,
          data.executedRemedyCents,
          data.verdict,
          data.rulingHash,
          new Date().toISOString()
        )
        .run();
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Inter-Galactic Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 1,048,576-bit STARK proof.
 */
export async function compactInterGalacticStateAction(
  previousStateRoot: string,
  transactions: InterGalacticTransaction[],
  circuitIdentifier: string = 'INTER_GALACTIC_STARK_1048576_RECURSIVE_20B_V1'
): Promise<InterGalacticCompactionActionResult> {
  try {
    const data = compactStateWithInterGalacticStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO inter_galactic_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             newStateRoot, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest, compacted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `STARK-IG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          data.batchTransactionCount,
          data.previousStateRoot,
          data.newStateRoot,
          data.starkProofBytesLength,
          data.verificationTimeNanos,
          data.verifierCircuitIdentifier,
          data.isMathematicallySound ? 1 : 0,
          data.compactionDigest,
          new Date().toISOString()
        )
        .run();
    }

    return { success: data.isMathematicallySound, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact Inter-Galactic STARK state',
    };
  }
}

/**
 * Server Action to check invariant preservation against the Inter-Galactic Constitutional Charter.
 */
export async function verifyInterGalacticInvariantsAction(
  invariants: InterGalacticConstitutionalInvariant[],
  targetArticleCode: string
): Promise<{ success: boolean; data: InterGalacticInvariantCheckOutput }> {
  const data = verifyInterGalacticConstitutionalInvariants(invariants, targetArticleCode);
  return {
    success: data.allowed,
    data,
  };
}
