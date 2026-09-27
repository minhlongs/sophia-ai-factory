'use server';

/**
 * @file interstellar-senate-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Interstellar Supreme Senate arbitration and invariant verification.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateInterstellarDispute,
  verifyInterstellarConstitutionalInvariants,
  type InterstellarDisputeInput,
  type InterstellarInvariantCheckOutput,
  type InterstellarSenateVerdictOutput,
} from '@/tree/governance/interstellar-senate-engine';
import {
  compactStateWithHyperStark,
  generateHyperStarkCommitment,
  type HyperStarkCommitmentOutput,
  type HyperStarkCompactionResult,
} from '@/tree/crypto/hyper-stark-compaction-engine';
import type {
  HyperStarkProtocol,
  HyperStarkTransaction,
  InterstellarConstitutionalInvariant,
} from '@/seed/types/hyper-stark-senate';

export interface InterstellarDisputeActionResult {
  success: boolean;
  data?: InterstellarSenateVerdictOutput;
  error?: string;
}

export interface HyperStarkCompactionActionResult {
  success: boolean;
  data?: HyperStarkCompactionResult;
  error?: string;
}

export interface InvariantCheckActionResult {
  success: boolean;
  data?: InterstellarInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate an interstellar commercial dispute and persist the ruling.
 */
export async function arbitrateInterstellarDisputeAction(
  params: InterstellarDisputeInput
): Promise<InterstellarDisputeActionResult> {
  try {
    const data = arbitrateInterstellarDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO interstellar_senate_arbitrations (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, contract_stark_root, evidence_sha256, senator_count,
             supermajority_threshold_pct, verdict, senators_slashed_count,
             executed_remedy_cents, resolved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `senate_disp_${Date.now()}`,
          params.disputeCaseRef,
          params.claimantParticipantId,
          params.respondentParticipantId,
          params.disputeValueCents,
          data.rulingHash,
          params.evidenceSha256,
          data.totalSenators,
          params.supermajorityThresholdPct ?? 85.0,
          data.verdict,
          data.senatorsSlashedCount,
          data.executedRemedyCents,
          data.verdict !== 'DELIBERATING' ? new Date().toISOString() : null
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Interstellar Senate arbitration error',
    };
  }
}

/**
 * Server Action to generate Hyper-STARK commitment and execute recursive state compaction.
 */
export async function compactHyperStarkBatchAction(
  previousStateRoot: string,
  transactions: HyperStarkTransaction[],
  circuitIdentifier: string = 'HYPER_STARK_FRI_RECURSIVE_4M_V1'
): Promise<HyperStarkCompactionActionResult> {
  try {
    const data = compactStateWithHyperStark(previousStateRoot, transactions, circuitIdentifier);
    const db = await getD1();

    if (db) {
      const proofRef = `HSTARK_PROOF_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO hyper_stark_compaction_proofs (
             id, proof_ref, batch_transaction_count, previous_state_root,
             new_state_root, stark_proof_bytes_length, verification_time_micros,
             verifier_circuit_identifier, is_mathematically_sound, verified_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `hstark_${Date.now()}`,
          proofRef,
          data.batchTransactionCount,
          data.previousStateRoot,
          data.newStateRoot,
          data.starkProofBytesLength,
          data.verificationTimeMicros,
          data.verifierCircuitIdentifier,
          data.isMathematicallySound ? 1 : 0,
          new Date().toISOString()
        )
        .run();
    }

    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Hyper-STARK compaction error',
    };
  }
}

/**
 * Server Action to verify proposed legislative amendment against immutable constitutional charter.
 */
export async function verifyConstitutionalAmendmentAction(
  proposedArticleCode: string,
  invariants: InterstellarConstitutionalInvariant[]
): Promise<InvariantCheckActionResult> {
  try {
    const data = verifyInterstellarConstitutionalInvariants(invariants, proposedArticleCode);
    return { success: data.allowed, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown constitutional verification error',
    };
  }
}
