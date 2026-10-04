'use server';

/**
 * @file sovereign-quingentimilliaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Quingenti-Millia-Quadrillion Conclave arbitration, constitutional invariant checks, and 274,877,906,944-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignQuingentimilliaquadrillionConclaveDispute,
  verifyQuingentimilliaquadrillionEmpireConstitutionalInvariant,
  type QuingentimilliaquadrillionDisputeInput,
  type QuingentimilliaquadrillionDisputeRuling,
  type QuingentimilliaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-quingentimilliaquadrillion-conclave-engine';
import {
  compactStateWithQuingentimilliaquadrillionBraidedStark,
  type QuingentimilliaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/quingentimilliaquadrillion-braided-stark-engine';
import type {
  QuingentimilliaquadrillionEmpireConstitutionalInvariant,
  QuingentimilliaquadrillionEmpireTransaction,
} from '@/seed/types/quingentimilliaquadrillion-braided-stark-conclave';

export interface SovereignQuingentimilliaquadrillionDisputeActionResult {
  success: boolean;
  data?: QuingentimilliaquadrillionDisputeRuling;
  error?: string;
}

export interface QuingentimilliaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: QuingentimilliaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface QuingentimilliaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: QuingentimilliaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Quingenti-Millia-Quadrillion dispute via Sovereign Conclave (99.99999999999999999999999% consensus).
 */
export async function arbitrateSovereignQuingentimilliaquadrillionDisputeAction(
  input: QuingentimilliaquadrillionDisputeInput
): Promise<SovereignQuingentimilliaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignQuingentimilliaquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_quingentimilliaquadrillion_conclave_disputes (
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
 * Server Action to compact 20,000,000,000,000,000 transactions into a 64-byte root via 274,877,906,944-bit STARK.
 */
export async function compactStateWithQuingentimilliaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: QuingentimilliaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<QuingentimilliaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithQuingentimilliaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO quingentimilliaquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `QUINGENTI-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify Quingenti-Millia-Quadrillion constitutional invariants.
 */
export async function verifyQuingentimilliaquadrillionConstitutionalInvariantAction(
  invariant: QuingentimilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<QuingentimilliaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyQuingentimilliaquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO quingentimilliaquadrillion_empire_constitutional_invariants (
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
