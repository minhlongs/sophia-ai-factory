'use server';

/**
 * @file galactic-high-tribunal-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Galactic Constitutional High Tribunal arbitration and invariant verification.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateGalacticDispute,
  verifyGalacticConstitutionalInvariants,
  type GalacticDisputeInput,
  type GalacticInvariantCheckOutput,
  type GalacticTribunalVerdictOutput,
} from '@/tree/governance/galactic-high-tribunal-engine';
import {
  compactStateWithHolographicStark,
  generateHolographicStarkCommitment,
  type HolographicStarkCommitmentOutput,
  type HolographicStarkCompactionResult,
} from '@/tree/crypto/holographic-stark-compaction-engine';
import type {
  GalacticConstitutionalInvariant,
  HolographicStarkProtocol,
  HolographicTransaction,
} from '@/seed/types/holographic-stark-tribunal';

export interface GalacticDisputeActionResult {
  success: boolean;
  data?: GalacticTribunalVerdictOutput;
  error?: string;
}

export interface HolographicStarkCompactionActionResult {
  success: boolean;
  data?: HolographicStarkCompactionResult;
  error?: string;
}

export interface InvariantCheckActionResult {
  success: boolean;
  data?: GalacticInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a galactic commercial dispute and persist the ruling.
 */
export async function arbitrateGalacticDisputeAction(
  params: GalacticDisputeInput
): Promise<GalacticDisputeActionResult> {
  try {
    const data = arbitrateGalacticDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO galactic_tribunal_arbitrations (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, contract_stark_root, evidence_sha256, juror_count,
             supermajority_threshold_pct, verdict, jurors_slashed_count,
             executed_remedy_cents, resolved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          params.disputeCaseRef,
          params.claimantParticipantId,
          params.respondentParticipantId,
          params.disputeValueCents,
          'CONTRACT_HOLOGRAPHIC_STARK_ROOT',
          params.evidenceSha256,
          data.totalJurors,
          params.supermajorityThresholdPct ?? 90.0,
          data.verdict,
          data.jurorsSlashedCount,
          data.executedRemedyCents
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Galactic dispute arbitration failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to compact 10,000,000 transactions into a 64-byte post-quantum Holographic root.
 */
export async function compactHolographicTransactionsAction(
  previousStateRoot: string,
  transactions: HolographicTransaction[],
  circuitIdentifier: string = 'HOLOGRAPHIC_STARK_FRI_RECURSIVE_10M_V1'
): Promise<HolographicStarkCompactionActionResult> {
  try {
    const data = compactStateWithHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO holographic_stark_compaction_proofs (
             id, proof_ref, batch_transaction_count, previous_state_root,
             new_state_root, stark_proof_bytes_length, verification_time_micros,
             verifier_circuit_identifier, is_mathematically_sound, verified_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          crypto.randomUUID(),
          `HOLO-STARK-${Date.now()}`,
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
    const message = err instanceof Error ? err.message : 'Holographic STARK compaction failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to verify proposed mutations against immutable constitutional invariants.
 */
export async function verifyGalacticInvariantCharterAction(
  invariants: GalacticConstitutionalInvariant[],
  proposedTargetArticleCode: string
): Promise<InvariantCheckActionResult> {
  try {
    const data = verifyGalacticConstitutionalInvariants(
      invariants,
      proposedTargetArticleCode
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invariant verification failed';
    return { success: false, error: message };
  }
}
