'use server';

/**
 * @file sovereign-quinquagintaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Quinquaginta-Quadrillion Conclave arbitration, constitutional invariant checks, and 4,294,967,296-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignQuinquagintaquadrillionConclaveDispute,
  verifyQuinquagintaquadrillionEmpireConstitutionalInvariants,
  type QuinquagintaquadrillionDisputeInput,
  type QuinquagintaquadrillionDisputeRuling,
  type QuinquagintaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-quinquagintaquadrillion-conclave-engine';
import {
  compactStateWithQuinquagintaquadrillionBraidedStark,
  type QuinquagintaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/quinquagintaquadrillion-braided-stark-engine';
import type {
  QuinquagintaquadrillionEmpireConstitutionalInvariant,
  QuinquagintaquadrillionEmpireTransaction,
} from '@/seed/types/quinquagintaquadrillion-braided-stark-conclave';

export interface SovereignQuinquagintaquadrillionDisputeActionResult {
  success: boolean;
  data?: QuinquagintaquadrillionDisputeRuling;
  error?: string;
}

export interface QuinquagintaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: QuinquagintaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface QuinquagintaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: QuinquagintaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Quinquaginta-Quadrillion dispute via Sovereign Conclave (99.99999999999999999% consensus).
 */
export async function arbitrateSovereignQuinquagintaquadrillionDisputeAction(
  input: QuinquagintaquadrillionDisputeInput
): Promise<SovereignQuinquagintaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignQuinquagintaquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_quinquagintaquadrillion_conclave_disputes (
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
 * Server Action to compact 200,000,000,000,000 transactions into a 64-byte root via 4,294,967,296-bit STARK.
 */
export async function compactStateWithQuinquagintaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: QuinquagintaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<QuinquagintaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithQuinquagintaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO quinquagintaquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             newState_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `QUINQUAGINTA-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify actions against Quinquaginta-Quadrillion Constitutional Invariants.
 */
export async function verifyQuinquagintaquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: QuinquagintaquadrillionEmpireConstitutionalInvariant[]
): Promise<QuinquagintaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyQuinquagintaquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
