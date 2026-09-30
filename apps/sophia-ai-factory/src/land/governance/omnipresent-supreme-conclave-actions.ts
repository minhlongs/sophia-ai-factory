'use server';

/**
 * @file omnipresent-supreme-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omnipresent Supreme Conclave arbitration, constitutional invariant checks, and 4,194,304-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateOmnipresentSupremeConclaveDispute,
  verifyOmnipresentEmpireConstitutionalInvariants,
  type OmnipresentEmpireDisputeInput,
  type OmnipresentEmpireDisputeRuling,
  type OmnipresentEmpireInvariantCheckOutput,
} from '@/tree/governance/omnipresent-supreme-conclave-engine';
import {
  compactStateWithOmniversalHolographicStark,
  type OmniversalHolographicStarkCompactionResult,
} from '@/tree/crypto/omniversal-holographic-stark-engine';
import type {
  OmnipresentEmpireConstitutionalInvariant,
  OmniversalEmpireTransaction,
} from '@/seed/types/omniversal-holographic-stark-conclave';

export interface OmnipresentSupremeDisputeActionResult {
  success: boolean;
  data?: OmnipresentEmpireDisputeRuling;
  error?: string;
}

export interface OmniversalHolographicCompactionActionResult {
  success: boolean;
  data?: OmniversalHolographicStarkCompactionResult;
  error?: string;
}

export interface OmnipresentEmpireInvariantActionResult {
  success: boolean;
  data?: OmnipresentEmpireInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate an Omnipresent dispute via Supreme Conclave (99.9999999% consensus).
 */
export async function arbitrateOmnipresentSupremeDisputeAction(
  input: OmnipresentEmpireDisputeInput
): Promise<OmnipresentSupremeDisputeActionResult> {
  try {
    const data = arbitrateOmnipresentSupremeConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO omnipresent_supreme_conclave_disputes (
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
      error: error instanceof Error ? error.message : 'Failed to arbitrate Omnipresent Supreme Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 4,194,304-bit STARK proof in <100 ns.
 */
export async function compactOmniversalHolographicStateAction(
  previousStateRoot: string,
  transactions: OmniversalEmpireTransaction[],
  circuitIdentifier: string = 'OMNIVERSAL_HOLOGRAPHIC_STARK_4194304_RECURSIVE_100B_V1'
): Promise<OmniversalHolographicCompactionActionResult> {
  try {
    const data = compactStateWithOmniversalHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO omniversal_holographic_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest, compacted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `OMNI-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact omniversal holographic state',
    };
  }
}

/**
 * Server Action to verify Omnipresent Empire constitutional invariants.
 */
export async function verifyOmnipresentEmpireInvariantsAction(
  invariants: OmnipresentEmpireConstitutionalInvariant[],
  targetArticleCode: string
): Promise<OmnipresentEmpireInvariantActionResult> {
  try {
    const data = verifyOmnipresentEmpireConstitutionalInvariants(invariants, targetArticleCode);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO omnipresent_empire_constitutional_invariants (
             id, article_code, article_title, is_strictly_immutable,
             last_theorem_verified_at, enforcement_circuit_hash
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(article_code) DO UPDATE SET
             last_theorem_verified_at = excluded.last_theorem_verified_at,
             enforcement_circuit_hash = excluded.enforcement_circuit_hash`
        )
        .bind(
          crypto.randomUUID(),
          data.articleCode,
          `ARTICLE_${data.articleCode}`,
          data.isStrictlyImmutable ? 1 : 0,
          new Date().toISOString(),
          data.verificationHash
        )
        .run();
    }

    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify omnipresent empire invariants',
    };
  }
}
