'use server';

/**
 * @file sovereign-biquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Bi-Quadrillion Conclave arbitration, constitutional invariant checks, and 33,554,432-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignBiquadrillionConclaveDispute,
  verifyBiquadrillionEmpireConstitutionalInvariants,
  type BiquadrillionDisputeInput,
  type BiquadrillionDisputeRuling,
  type BiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-biquadrillion-conclave-engine';
import {
  compactStateWithBiquadrillionBraidedStark,
  type BiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/biquadrillion-braided-stark-engine';
import type {
  BiquadrillionEmpireConstitutionalInvariant,
  BiquadrillionEmpireTransaction,
} from '@/seed/types/biquadrillion-braided-stark-conclave';

export interface SovereignBiquadrillionDisputeActionResult {
  success: boolean;
  data?: BiquadrillionDisputeRuling;
  error?: string;
}

export interface BiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: BiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface BiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: BiquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Bi-Quadrillion dispute via Sovereign Conclave (99.9999999999% consensus).
 */
export async function arbitrateSovereignBiquadrillionDisputeAction(
  input: BiquadrillionDisputeInput
): Promise<SovereignBiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignBiquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_biquadrillion_conclave_disputes (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, evidence_sha256, total_jurors, claimant_votes,
             respondent_votes, supermajority_pct, jurors_slashed_count,
             total_slashed_stake_cents, executed_remedy_cents, verdict,
             ruling_hash, ruled_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
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
          data.rulingHash
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to compact 800,000,000,000 transactions into a 64-byte root via 33,554,432-bit STARK.
 */
export async function compactStateWithBiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: BiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<BiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithBiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO biquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `BIQUAD-STARK-BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify adherence to Bi-Quadrillion Empire Constitutional Invariants.
 */
export async function verifyBiquadrillionEmpireInvariantAction(
  invariantsOrCode: BiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): Promise<BiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyBiquadrillionEmpireConstitutionalInvariants(
      invariantsOrCode,
      proposedTargetArticleCode
    );

    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
