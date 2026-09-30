'use server';

/**
 * @file sovereign-pentaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Penta-Quadrillion Conclave arbitration, constitutional invariant checks, and 67,108,864-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignPentaquadrillionConclaveDispute,
  verifyPentaquadrillionEmpireConstitutionalInvariants,
  type PentaquadrillionDisputeInput,
  type PentaquadrillionDisputeRuling,
  type PentaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-pentaquadrillion-conclave-engine';
import {
  compactStateWithPentaquadrillionBraidedStark,
  type PentaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/pentaquadrillion-braided-stark-engine';
import type {
  PentaquadrillionEmpireConstitutionalInvariant,
  PentaquadrillionEmpireTransaction,
} from '@/seed/types/pentaquadrillion-braided-stark-conclave';

export interface SovereignPentaquadrillionDisputeActionResult {
  success: boolean;
  data?: PentaquadrillionDisputeRuling;
  error?: string;
}

export interface PentaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: PentaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface PentaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: PentaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Penta-Quadrillion dispute via Sovereign Conclave (99.99999999999% consensus).
 */
export async function arbitrateSovereignPentaquadrillionDisputeAction(
  input: PentaquadrillionDisputeInput
): Promise<SovereignPentaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignPentaquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_pentaquadrillion_conclave_disputes (
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
 * Server Action to compact 2,000,000,000,000 transactions into a 64-byte root via 67,108,864-bit STARK.
 */
export async function compactStateWithPentaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: PentaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<PentaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithPentaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO pentaquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `PENTA-STARK-BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify adherence to Penta-Quadrillion Empire Constitutional Invariants.
 */
export async function verifyPentaquadrillionEmpireInvariantAction(
  invariantsOrCode: PentaquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): Promise<PentaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyPentaquadrillionEmpireConstitutionalInvariants(
      invariantsOrCode,
      proposedTargetArticleCode
    );

    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
