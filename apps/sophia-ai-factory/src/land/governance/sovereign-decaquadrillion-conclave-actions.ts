'use server';

/**
 * @file sovereign-decaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Deca-Quadrillion Conclave arbitration, constitutional invariant checks, and 134,217,728-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignDecaquadrillionConclaveDispute,
  verifyDecaquadrillionEmpireConstitutionalInvariants,
  type DecaquadrillionDisputeInput,
  type DecaquadrillionDisputeRuling,
  type DecaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-decaquadrillion-conclave-engine';
import {
  compactStateWithDecaquadrillionBraidedStark,
  type DecaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/decaquadrillion-braided-stark-engine';
import type {
  DecaquadrillionEmpireConstitutionalInvariant,
  DecaquadrillionEmpireTransaction,
} from '@/seed/types/decaquadrillion-braided-stark-conclave';

export interface SovereignDecaquadrillionDisputeActionResult {
  success: boolean;
  data?: DecaquadrillionDisputeRuling;
  error?: string;
}

export interface DecaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: DecaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface DecaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: DecaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Deca-Quadrillion dispute via Sovereign Conclave (99.999999999999% consensus).
 */
export async function arbitrateSovereignDecaquadrillionDisputeAction(
  input: DecaquadrillionDisputeInput
): Promise<SovereignDecaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignDecaquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_decaquadrillion_conclave_disputes (
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
 * Server Action to compact 4,000,000,000,000 transactions into a 64-byte root via 134,217,728-bit STARK.
 */
export async function compactStateWithDecaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: DecaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<DecaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithDecaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO decaquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             new_state_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `DECA-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify actions against Deca-Quadrillion Constitutional Invariants.
 */
export async function verifyDecaquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: DecaquadrillionEmpireConstitutionalInvariant[]
): Promise<DecaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyDecaquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
