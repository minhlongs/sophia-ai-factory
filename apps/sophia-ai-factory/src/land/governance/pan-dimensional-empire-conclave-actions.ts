'use server';

/**
 * @file pan-dimensional-empire-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Pan-Dimensional Empire Conclave arbitration, constitutional invariant checks, and STARK compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitratePanDimensionalEmpireConclaveDispute,
  verifyPanDimensionalEmpireConstitutionalInvariants,
  type PanDimensionalEmpireDisputeInput,
  type PanDimensionalEmpireDisputeRuling,
  type PanDimensionalEmpireInvariantCheckOutput,
} from '@/tree/governance/pan-dimensional-empire-conclave-engine';
import {
  compactStateWithPanDimensionalHolographicStark,
  type PanDimensionalHolographicStarkCompactionResult,
} from '@/tree/crypto/pan-dimensional-holographic-stark-engine';
import type {
  PanDimensionalEmpireConstitutionalInvariant,
  PanDimensionalEmpireTransaction,
} from '@/seed/types/pan-dimensional-holographic-stark-conclave';

export interface PanDimensionalEmpireDisputeActionResult {
  success: boolean;
  data?: PanDimensionalEmpireDisputeRuling;
  error?: string;
}

export interface PanDimensionalHolographicCompactionActionResult {
  success: boolean;
  data?: PanDimensionalHolographicStarkCompactionResult;
  error?: string;
}

/**
 * Server Action to arbitrate a Pan-Dimensional dispute via Supreme Conclave (99.999999% consensus).
 */
export async function arbitratePanDimensionalEmpireDisputeAction(
  input: PanDimensionalEmpireDisputeInput
): Promise<PanDimensionalEmpireDisputeActionResult> {
  try {
    const data = arbitratePanDimensionalEmpireConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO pan_dimensional_supreme_conclave_disputes (
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
      error: error instanceof Error ? error.message : 'Failed to arbitrate Pan-Dimensional Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 2,097,152-bit STARK proof.
 */
export async function compactPanDimensionalHolographicStateAction(
  previousStateRoot: string,
  transactions: PanDimensionalEmpireTransaction[],
  circuitIdentifier: string = 'PAN_DIMENSIONAL_HOLOGRAPHIC_STARK_2097152_RECURSIVE_40B_V1'
): Promise<PanDimensionalHolographicCompactionActionResult> {
  try {
    const data = compactStateWithPanDimensionalHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO pan_dimensional_holographic_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest, compacted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `STARK-PAN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      error: error instanceof Error ? error.message : 'Failed to compact Pan-Dimensional STARK state',
    };
  }
}

/**
 * Server Action to check invariant preservation against the Pan-Dimensional Empire Constitutional Charter.
 */
export async function verifyPanDimensionalEmpireInvariantsAction(
  invariants: PanDimensionalEmpireConstitutionalInvariant[],
  targetArticleCode: string
): Promise<{ success: boolean; data: PanDimensionalEmpireInvariantCheckOutput }> {
  const data = verifyPanDimensionalEmpireConstitutionalInvariants(invariants, targetArticleCode);
  return {
    success: data.allowed,
    data,
  };
}
