'use server';

/**
 * @file planetary-court-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for zk-SNARK state compaction and Planetary Constitutional Court arbitration.
 */

import { getD1 } from '@/seed/db/client';
import {
  compactStateWithZkSnark,
  type ZkStateCompactionResult,
} from '@/tree/crypto/post-quantum-zk-engine';
import {
  arbitratePlanetaryDispute,
  verifyConstitutionalInvariants,
  type ConstitutionalInvariantCheckOutput,
  type PlanetaryCourtVerdictOutput,
  type PlanetaryDisputeInput,
} from '@/tree/governance/planetary-court-engine';
import type {
  CompactedTransaction,
  ConstitutionalInvariant,
} from '@/seed/types/post-quantum-constitution';

export interface ZkCompactActionResult {
  success: boolean;
  data?: ZkStateCompactionResult;
  error?: string;
}

export interface CourtVerdictActionResult {
  success: boolean;
  data?: PlanetaryCourtVerdictOutput;
  error?: string;
}

export interface InvariantCheckActionResult {
  success: boolean;
  data?: ConstitutionalInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to compact transactions with recursive zk-SNARK proof and record state root.
 */
export async function compactZkStateAction(
  previousStateRoot: string,
  transactions: CompactedTransaction[],
  proofRef: string = `PROOF_${Date.now()}`
): Promise<ZkCompactActionResult> {
  try {
    const data = compactStateWithZkSnark(previousStateRoot, transactions);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO zk_state_compaction_proofs (
             id, proof_ref, batch_transaction_count, previous_state_root,
             new_state_root, snark_proof_bytes_length, verification_time_micros,
             verifier_circuit_identifier, is_mathematically_sound
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `zk_${Date.now()}`,
          proofRef,
          data.batchTransactionCount,
          data.previousStateRoot,
          data.newStateRoot,
          data.snarkProofBytesLength,
          data.verificationTimeMicros,
          data.verifierCircuitIdentifier,
          data.isMathematicallySound ? 1 : 0
        )
        .run();
    }

    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown zk state compaction failure',
    };
  }
}

/**
 * Server Action to arbitrate dispute before the Planetary Supreme Court and record verdict.
 */
export async function arbitratePlanetaryDisputeAction(
  params: PlanetaryDisputeInput
): Promise<CourtVerdictActionResult> {
  try {
    const data = arbitratePlanetaryDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO planetary_court_arbitrations (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, contract_merkle_root, evidence_sha256,
             juror_count, supermajority_threshold_pct, verdict,
             jurors_slashed_count, executed_remedy_cents, resolved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `court_${Date.now()}`,
          params.disputeCaseRef,
          params.claimantParticipantId,
          params.respondentParticipantId,
          params.disputeValueCents,
          'CONTRACT_ROOT_PLACEHOLDER',
          params.evidenceSha256,
          data.totalJurors,
          params.supermajorityThresholdPct ?? 75.0,
          data.verdict,
          data.jurorsSlashedCount,
          data.executedRemedyCents,
          data.verdict !== 'DELIBERATING' ? new Date().toISOString() : null
        )
        .run();
    }

    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown court arbitration failure',
    };
  }
}

/**
 * Server Action to verify constitutional immutability invariants.
 */
export async function verifyConstitutionalInvariantAction(
  invariants: ConstitutionalInvariant[],
  articleCode: string
): Promise<InvariantCheckActionResult> {
  try {
    const data = verifyConstitutionalInvariants(invariants, articleCode);
    return { success: data.allowed, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown invariant verification failure',
    };
  }
}
