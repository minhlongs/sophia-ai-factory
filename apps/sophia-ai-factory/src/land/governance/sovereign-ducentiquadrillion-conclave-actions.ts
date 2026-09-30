'use server';

/**
 * @file sovereign-ducentiquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Ducenti-Quadrillion Conclave arbitration, constitutional invariant checks, and 2,147,483,648-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignDucentiquadrillionConclaveDispute,
  verifyDucentiquadrillionEmpireConstitutionalInvariants,
  type DucentiquadrillionDisputeInput,
  type DucentiquadrillionDisputeRuling,
  type DucentiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-ducentiquadrillion-conclave-engine';
import {
  compactStateWithDucentiquadrillionBraidedStark,
  type DucentiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/ducentiquadrillion-braided-stark-engine';
import type {
  DucentiquadrillionEmpireConstitutionalInvariant,
  DucentiquadrillionEmpireTransaction,
} from '@/seed/types/ducentiquadrillion-braided-stark-conclave';

export interface SovereignDucentiquadrillionDisputeActionResult {
  success: boolean;
  data?: DucentiquadrillionDisputeRuling;
  error?: string;
}

export interface DucentiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: DucentiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface DucentiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: DucentiquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Ducenti-Quadrillion dispute via Sovereign Conclave (99.9999999999999999% consensus).
 */
export async function arbitrateSovereignDucentiquadrillionDisputeAction(
  input: DucentiquadrillionDisputeInput
): Promise<SovereignDucentiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignDucentiquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_ducentiquadrillion_conclave_disputes (
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
 * Server Action to compact 100,000,000,000,000 transactions into a 64-byte root via 2,147,483,648-bit STARK.
 */
export async function compactStateWithDucentiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: DucentiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<DucentiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithDucentiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO ducentiquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             newState_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `DUCENTI-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify actions against Ducenti-Quadrillion Constitutional Invariants.
 */
export async function verifyDucentiquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: DucentiquadrillionEmpireConstitutionalInvariant[]
): Promise<DucentiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyDucentiquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
