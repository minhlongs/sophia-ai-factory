'use server';

/**
 * @file sovereign-centummilliaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Centummillia-Quadrillion Conclave arbitration, constitutional invariant checks, and 8,589,934,592-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignCentummilliaquadrillionConclaveDispute,
  verifyCentummilliaquadrillionEmpireConstitutionalInvariant,
  type CentummilliaquadrillionDisputeInput,
  type CentummilliaquadrillionDisputeRuling,
  type CentummilliaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-centummilliaquadrillion-conclave-engine';
import {
  compactStateWithCentummilliaquadrillionBraidedStark,
  type CentummilliaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/centummilliaquadrillion-braided-stark-engine';
import type {
  CentummilliaquadrillionEmpireConstitutionalInvariant,
  CentummilliaquadrillionEmpireTransaction,
} from '@/seed/types/centummilliaquadrillion-braided-stark-conclave';

export interface SovereignCentummilliaquadrillionDisputeActionResult {
  success: boolean;
  data?: CentummilliaquadrillionDisputeRuling;
  error?: string;
}

export interface CentummilliaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: CentummilliaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface CentummilliaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: CentummilliaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Centummillia-Quadrillion dispute via Sovereign Conclave (99.999999999999999999% consensus).
 */
export async function arbitrateSovereignCentummilliaquadrillionDisputeAction(
  input: CentummilliaquadrillionDisputeInput
): Promise<SovereignCentummilliaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignCentummilliaquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_centummilliaquadrillion_conclave_disputes (
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
 * Server Action to compact 400,000,000,000,000 transactions into a 64-byte root via 8,589,934,592-bit STARK.
 */
export async function compactStateWithCentummilliaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: CentummilliaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<CentummilliaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithCentummilliaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO centummilliaquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `CENTUMMILLIA-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify Centummillia-Quadrillion constitutional invariants.
 */
export async function verifyCentummilliaquadrillionConstitutionalInvariantAction(
  invariant: CentummilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<CentummilliaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyCentummilliaquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO centummilliaquadrillion_empire_constitutional_invariants (
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
