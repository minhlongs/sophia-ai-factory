'use server';

/**
 * @file sovereign-milliaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Millia-Quadrillion Conclave arbitration, constitutional invariant checks, and 68,719,476,736-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignMilliaquadrillionConclaveDispute,
  verifyMilliaquadrillionEmpireConstitutionalInvariant,
  type MilliaquadrillionDisputeInput,
  type MilliaquadrillionDisputeRuling,
  type MilliaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-milliaquadrillion-conclave-engine';
import {
  compactStateWithMilliaquadrillionBraidedStark,
  type MilliaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/milliaquadrillion-braided-stark-engine';
import type {
  MilliaquadrillionEmpireConstitutionalInvariant,
  MilliaquadrillionEmpireTransaction,
} from '@/seed/types/milliaquadrillion-braided-stark-conclave';

export interface SovereignMilliaquadrillionDisputeActionResult {
  success: boolean;
  data?: MilliaquadrillionDisputeRuling;
  error?: string;
}

export interface MilliaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: MilliaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface MilliaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: MilliaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Millia-Quadrillion dispute via Sovereign Conclave (99.999999999999999999999% consensus).
 */
export async function arbitrateSovereignMilliaquadrillionDisputeAction(
  input: MilliaquadrillionDisputeInput
): Promise<SovereignMilliaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignMilliaquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_milliaquadrillion_conclave_disputes (
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
 * Server Action to compact 4,000,000,000,000,000 transactions into a 64-byte root via 68,719,476,736-bit STARK.
 */
export async function compactStateWithMilliaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: MilliaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<MilliaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithMilliaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO milliaquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `MILLIA-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify Millia-Quadrillion constitutional invariants.
 */
export async function verifyMilliaquadrillionConstitutionalInvariantAction(
  invariant: MilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<MilliaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyMilliaquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO milliaquadrillion_empire_constitutional_invariants (
             id, article_code, article_title, is_strictly_immutable,
             last_theorem_verified_at, enforcement_circuit_hash, created_at
           ) VALUES (?, ?, ?, ?, datetime('now'), ?, datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          invariant.articleCode,
          invariant.articleTitle,
          invariant.isStrictlyImmutable ? 1 : 0,
          data.verificationHash
        )
        .run();
    }

    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
