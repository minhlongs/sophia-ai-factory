'use server';

/**
 * @file multiverse-directorate-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Multiverse Constitutional Directorate arbitration and invariant verification.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateMultiverseDispute,
  verifyMultiverseConstitutionalInvariants,
  type MultiverseDisputeInput,
  type MultiverseInvariantCheckOutput,
  type MultiverseDirectorateVerdictOutput,
} from '@/tree/governance/multiverse-directorate-engine';
import {
  compactStateWithAnyonicStark,
  generateAnyonicStarkCommitment,
  type AnyonicStarkCommitmentOutput,
  type AnyonicStarkCompactionResult,
} from '@/tree/crypto/anyonic-stark-compaction-engine';
import type {
  AnyonicStarkProtocol,
  AnyonicTransaction,
  MultiverseConstitutionalInvariant,
} from '@/seed/types/anyonic-stark-directorate';

export interface MultiverseDisputeActionResult {
  success: boolean;
  data?: MultiverseDirectorateVerdictOutput;
  error?: string;
}

export interface AnyonicStarkCompactionActionResult {
  success: boolean;
  data?: AnyonicStarkCompactionResult;
  error?: string;
}

export interface InvariantCheckActionResult {
  success: boolean;
  data?: MultiverseInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a multiverse commercial dispute and persist the ruling.
 */
export async function arbitrateMultiverseDisputeAction(
  params: MultiverseDisputeInput
): Promise<MultiverseDisputeActionResult> {
  try {
    const data = arbitrateMultiverseDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO multiverse_directorate_arbitrations (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, contract_stark_root, evidence_sha256, director_count,
             supermajority_threshold_pct, verdict, directors_slashed_count,
             executed_remedy_cents, resolved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          params.disputeCaseRef,
          params.claimantParticipantId,
          params.respondentParticipantId,
          params.disputeValueCents,
          'CONTRACT_ANYONIC_STARK_ROOT',
          params.evidenceSha256,
          data.totalDirectors,
          params.supermajorityThresholdPct ?? 95.0,
          data.verdict,
          data.directorsSlashedCount,
          data.executedRemedyCents
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Multiverse dispute arbitration failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to compact 20,000,000 transactions into a 64-byte post-quantum Anyonic root.
 */
export async function compactAnyonicTransactionsAction(
  previousStateRoot: string,
  transactions: AnyonicTransaction[],
  circuitIdentifier: string = 'ANYONIC_STARK_BRAIDED_RECURSIVE_20M_V1'
): Promise<AnyonicStarkCompactionActionResult> {
  try {
    const data = compactStateWithAnyonicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO anyonic_stark_compaction_proofs (
             id, proof_ref, batch_transaction_count, previous_state_root,
             new_state_root, stark_proof_bytes_length, verification_time_micros,
             verifier_circuit_identifier, is_mathematically_sound, verified_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `ANYONIC-STARK-${Date.now()}`,
          data.batchTransactionCount,
          data.previousStateRoot,
          data.newStateRoot,
          data.starkProofBytesLength,
          data.verificationTimeMicros,
          data.verifierCircuitIdentifier,
          data.isMathematicallySound ? 1 : 0
        )
        .run();
    }

    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Anyonic STARK compaction failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to verify proposed mutations against immutable constitutional invariants.
 */
export async function verifyMultiverseInvariantCharterAction(
  invariants: MultiverseConstitutionalInvariant[],
  proposedTargetArticleCode: string
): Promise<InvariantCheckActionResult> {
  try {
    const data = verifyMultiverseConstitutionalInvariants(
      invariants,
      proposedTargetArticleCode
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invariant verification failed';
    return { success: false, error: message };
  }
}
