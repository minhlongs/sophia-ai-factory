'use server';

/**
 * @file sovereign-centumquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Centum-Quadrillion Conclave arbitration, constitutional invariant checks, and 1,073,741,824-bit STARK state compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateSovereignCentumquadrillionConclaveDispute,
  verifyCentumquadrillionEmpireConstitutionalInvariants,
  type CentumquadrillionDisputeInput,
  type CentumquadrillionDisputeRuling,
  type CentumquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-centumquadrillion-conclave-engine';
import {
  compactStateWithCentumquadrillionBraidedStark,
  type CentumquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/centumquadrillion-braided-stark-engine';
import type {
  CentumquadrillionEmpireConstitutionalInvariant,
  CentumquadrillionEmpireTransaction,
} from '@/seed/types/centumquadrillion-braided-stark-conclave';

export interface SovereignCentumquadrillionDisputeActionResult {
  success: boolean;
  data?: CentumquadrillionDisputeRuling;
  error?: string;
}

export interface CentumquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: CentumquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface CentumquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: CentumquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Centum-Quadrillion dispute via Sovereign Conclave (99.999999999999999% consensus).
 */
export async function arbitrateSovereignCentumquadrillionDisputeAction(
  input: CentumquadrillionDisputeInput
): Promise<SovereignCentumquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignCentumquadrillionConclaveDispute(input);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO sovereign_centumquadrillion_conclave_disputes (
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
 * Server Action to compact 40,000,000,000,000 transactions into a 64-byte root via 1,073,741,824-bit STARK.
 */
export async function compactStateWithCentumquadrillionStarkAction(
  previousStateRoot: string,
  transactions: CentumquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<CentumquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithCentumquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO centumquadrillion_braided_stark_batches (
             id, batch_ref, batch_tx_count, previous_state_root,
             newState_root, proof_bytes_length, verification_time_nanos,
             circuit_identifier, is_mathematically_sound, stark_digest,
             compacted_at, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `CENTUM-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
 * Server Action to verify actions against Centum-Quadrillion Constitutional Invariants.
 */
export async function verifyCentumquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: CentumquadrillionEmpireConstitutionalInvariant[]
): Promise<CentumquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyCentumquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
