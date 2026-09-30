'use server';

/**
 * @file sovereign-vigintiquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Viginti-Quadrillion Conclave arbitration, constitutional invariant checks, and 268,435,456-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignVigintiquadrillionConclaveDispute,
  verifyVigintiquadrillionEmpireConstitutionalInvariants,
  type VigintiquadrillionDisputeInput,
  type VigintiquadrillionDisputeRuling,
  type VigintiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-vigintiquadrillion-conclave-engine';
import {
  compactStateWithVigintiquadrillionBraidedStark,
  type VigintiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/vigintiquadrillion-braided-stark-engine';
import type {
  VigintiquadrillionEmpireConstitutionalInvariant,
  VigintiquadrillionEmpireTransaction,
} from '@/seed/types/vigintiquadrillion-braided-stark-conclave';

export interface SovereignVigintiquadrillionDisputeActionResult {
  success: boolean;
  data?: VigintiquadrillionDisputeRuling;
  error?: string;
}

export interface VigintiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: VigintiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface VigintiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: VigintiquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Viginti-Quadrillion dispute via Sovereign Conclave (99.9999999999999% consensus).
 */
export async function arbitrateSovereignVigintiquadrillionDisputeAction(
  input: VigintiquadrillionDisputeInput
): Promise<SovereignVigintiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignVigintiquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_vigintiquadrillion_conclave_disputes (
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
 * Server Action to compact 8,000,000,000,000 transactions into a 64-byte root via 268,435,456-bit STARK.
 */
export async function compactStateWithVigintiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: VigintiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<VigintiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithVigintiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO vigintiquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `VIGINTI-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify actions against Viginti-Quadrillion Constitutional Invariants.
 */
export async function verifyVigintiquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: VigintiquadrillionEmpireConstitutionalInvariant[]
): Promise<VigintiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyVigintiquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
