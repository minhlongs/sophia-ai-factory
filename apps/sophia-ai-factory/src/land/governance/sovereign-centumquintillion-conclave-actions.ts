'use server';

/**
 * @file sovereign-centumquintillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Centum-Quintillion ($100.0 Quintillion) 4,398B-Bit Braided STARK Compaction and Sovereign Conclave Dispute Arbitration.
 */

import { getD1 } from '@/seed/db/client';
import {
  compactStateWithCentumquintillionBraidedStark,
  type CentumquintillionBraidedStarkCompactionResult,
} from '@/tree/crypto/centumquintillion-braided-stark-engine';
import {
  arbitrateSovereignCentumquintillionConclaveDispute,
  type CentumquintillionDisputeArbitrationInput,
  type CentumquintillionDisputeRulingResult,
} from '@/tree/governance/sovereign-centumquintillion-conclave-engine';
import type { CentumquintillionEmpireTransaction } from '@/seed/types/centumquintillion-braided-stark-conclave';

export interface CentumquintillionBraidedStarkActionResult {
  success: boolean;
  data?: CentumquintillionBraidedStarkCompactionResult;
  error?: string;
}

export interface CentumquintillionDisputeActionResult {
  success: boolean;
  data?: CentumquintillionDisputeRulingResult;
  error?: string;
}

/**
 * Server Action to execute 4,398,046,511,104-bit Non-Archimedean Braided STARK compaction.
 */
export async function compactCentumquintillionBraidedStarkAction(
  previousStateRoot: string,
  transactions: CentumquintillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<CentumquintillionBraidedStarkActionResult> {
  try {
    const data = compactStateWithCentumquintillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO centumquintillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest, compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `STARK-CENTUM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          data.batchTransactionCount,
          data.previousStateRoot,
          data.newStateRoot,
          data.starkProofBytesLength,
          data.verificationTimeNanos,
          data.verifierCircuitIdentifier,
          data.isMathematicallySound ? 1 : 0,
          data.compactionDigest
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown STARK compaction error';
    return { success: false, error: message };
  }
}

/**
 * Server Action to arbitrate a Sovereign Conclave dispute with 27-nines consensus.
 */
export async function arbitrateCentumquintillionDisputeAction(
  input: CentumquintillionDisputeArbitrationInput
): Promise<CentumquintillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignCentumquintillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO centumquintillion_conclave_disputes (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, evidence_sha256, total_jurors, claimant_votes,
             respondent_votes, supermajority_pct, jurors_slashed_count,
             total_slashed_stake_cents, executed_remedy_cents, verdict,
             ruling_hash, ruled_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          data.disputeCaseRef,
          input.claimantParticipantId,
          input.respondentParticipantId,
          input.disputeValueCents,
          input.evidenceSha256,
          data.totalJurors,
          data.claimantVotes,
          data.respondentVotes,
          data.achievedSupermajorityPct,
          data.jurorsSlashedCount,
          data.totalSlashedStakeCents,
          data.executedRemedyCents,
          data.verdict,
          data.rulingHash
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown dispute arbitration error';
    return { success: false, error: message };
  }
}
