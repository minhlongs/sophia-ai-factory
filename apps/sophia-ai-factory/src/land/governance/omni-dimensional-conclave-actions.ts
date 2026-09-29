'use server';

/**
 * @file omni-dimensional-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omni-Dimensional Conclave arbitration, constitutional invariant checks, and STARK compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateOmniDimensionalConclaveDispute,
  verifyOmniDimensionalConstitutionalInvariants,
  type OmniDimensionalDisputeInput,
  type OmniDimensionalDisputeRuling,
  type OmniDimensionalInvariantCheckOutput,
} from '@/tree/governance/omni-dimensional-supreme-conclave-engine';
import {
  compactStateWithOmniDimensionalStark,
  type OmniDimensionalStarkCompactionResult,
} from '@/tree/crypto/omni-dimensional-stark-engine';
import type {
  OmniDimensionalConstitutionalInvariant,
  OmniDimensionalTransaction,
} from '@/seed/types/omni-dimensional-stark-conclave';

export interface OmniDimensionalDisputeActionResult {
  success: boolean;
  data?: OmniDimensionalDisputeRuling;
  error?: string;
}

export interface OmniDimensionalCompactionActionResult {
  success: boolean;
  data?: OmniDimensionalStarkCompactionResult;
  error?: string;
}

/**
 * Server Action to arbitrate an Omni-Dimensional dispute via Supreme Conclave (99.9999% consensus).
 */
export async function arbitrateOmniDimensionalDisputeAction(
  input: OmniDimensionalDisputeInput
): Promise<OmniDimensionalDisputeActionResult> {
  try {
    const data = arbitrateOmniDimensionalConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO omni_dimensional_conclave_disputes (
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
      error: error instanceof Error ? error.message : 'Failed to arbitrate Omni-Dimensional Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 524,288-bit STARK proof.
 */
export async function compactOmniDimensionalStateAction(
  previousStateRoot: string,
  transactions: OmniDimensionalTransaction[],
  circuitIdentifier: string = 'OMNI_DIMENSIONAL_STARK_524288_RECURSIVE_10B_V1'
): Promise<OmniDimensionalCompactionActionResult> {
  try {
    const data = compactStateWithOmniDimensionalStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO omni_dimensional_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_micros,
             circuit_identifier, is_mathematically_sound, stark_digest, compacted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `STARK-OMNI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          data.batchTransactionCount,
          data.previousStateRoot,
          data.newStateRoot,
          data.starkProofBytesLength,
          data.verificationTimeMicros,
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
      error: error instanceof Error ? error.message : 'Failed to compact Omni-Dimensional STARK state',
    };
  }
}

/**
 * Server Action to check invariant preservation against the Omni-Dimensional Constitutional Charter.
 */
export async function verifyOmniDimensionalInvariantsAction(
  invariants: OmniDimensionalConstitutionalInvariant[],
  targetArticleCode: string
): Promise<{ success: boolean; data: OmniDimensionalInvariantCheckOutput }> {
  const data = verifyOmniDimensionalConstitutionalInvariants(invariants, targetArticleCode);
  return {
    success: data.allowed,
    data,
  };
}
