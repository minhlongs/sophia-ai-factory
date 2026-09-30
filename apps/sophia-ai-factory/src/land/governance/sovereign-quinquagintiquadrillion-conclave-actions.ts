'use server';

/**
 * @file sovereign-quinquagintiquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Quinquaginti-Quadrillion Conclave arbitration, constitutional invariant checks, and 536,870,912-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignQuinquagintiquadrillionConclaveDispute,
  verifyQuinquagintiquadrillionEmpireConstitutionalInvariants,
  type QuinquagintiquadrillionDisputeInput,
  type QuinquagintiquadrillionDisputeRuling,
  type QuinquagintiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-quinquagintiquadrillion-conclave-engine';
import {
  compactStateWithQuinquagintiquadrillionBraidedStark,
  type QuinquagintiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/quinquagintiquadrillion-braided-stark-engine';
import type {
  QuinquagintiquadrillionEmpireConstitutionalInvariant,
  QuinquagintiquadrillionEmpireTransaction,
} from '@/seed/types/quinquagintiquadrillion-braided-stark-conclave';

export interface SovereignQuinquagintiquadrillionDisputeActionResult {
  success: boolean;
  data?: QuinquagintiquadrillionDisputeRuling;
  error?: string;
}

export interface QuinquagintiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: QuinquagintiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface QuinquagintiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: QuinquagintiquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Quinquaginti-Quadrillion dispute via Sovereign Conclave (99.99999999999999% consensus).
 */
export async function arbitrateSovereignQuinquagintiquadrillionDisputeAction(
  input: QuinquagintiquadrillionDisputeInput
): Promise<SovereignQuinquagintiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignQuinquagintiquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_quinquagintiquadrillion_conclave_disputes (
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
 * Server Action to compact 20,000,000,000,000 transactions into a 64-byte root via 536,870,912-bit STARK.
 */
export async function compactStateWithQuinquagintiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: QuinquagintiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<QuinquagintiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithQuinquagintiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO quinquagintiquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             newState_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `QUINQUAGINTI-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify actions against Quinquaginti-Quadrillion Constitutional Invariants.
 */
export async function verifyQuinquagintiquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: QuinquagintiquadrillionEmpireConstitutionalInvariant[]
): Promise<QuinquagintiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyQuinquagintiquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
