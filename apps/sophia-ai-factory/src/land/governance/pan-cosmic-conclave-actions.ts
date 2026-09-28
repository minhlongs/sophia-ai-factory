'use server';

/**
 * @file pan-cosmic-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Pan-Cosmic Constitutional Conclave Arbitration and 4096-Bit Braided STARK.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitratePanCosmicDispute,
  verifyPanCosmicConstitutionalInvariants,
  type PanCosmicDisputeInput,
  type PanCosmicDisputeRuling,
  type PanCosmicInvariantCheckOutput,
} from '@/tree/governance/pan-cosmic-conclave-engine';
import {
  compactStateWithBraidedStark,
  type BraidedStarkCompactionResult,
} from '@/tree/crypto/topological-braided-stark-engine';
import type {
  BraidedTransaction,
  PanCosmicConstitutionalInvariant,
} from '@/seed/types/topological-braided-conclave';

export interface PanCosmicArbitrationActionResult {
  success: boolean;
  data?: PanCosmicDisputeRuling;
  error?: string;
}

export interface PanCosmicInvariantActionResult {
  success: boolean;
  data?: PanCosmicInvariantCheckOutput;
  error?: string;
}

export interface BraidedCompactionActionResult {
  success: boolean;
  data?: BraidedStarkCompactionResult;
  error?: string;
}

/**
 * Server Action to arbitrate dispute via Pan-Cosmic Constitutional Conclave.
 */
export async function arbitratePanCosmicDisputeAction(
  params: PanCosmicDisputeInput
): Promise<PanCosmicArbitrationActionResult> {
  try {
    const data = arbitratePanCosmicDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO pan_cosmic_conclave_arbitrations (
             id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
             dispute_value_cents, contract_stark_root, evidence_sha256, conclave_juror_count,
             supermajority_threshold_pct, verdict, jurors_slashed_count, executed_remedy_cents, resolved_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          params.disputeCaseRef,
          params.claimantParticipantId,
          params.respondentParticipantId,
          params.disputeValueCents,
          data.rulingHash,
          params.evidenceSha256,
          data.totalJurors,
          params.supermajorityThresholdPct ?? 98.0,
          data.verdict,
          data.jurorsSlashedCount,
          data.executedRemedyCents,
          new Date().toISOString()
        )
        .run();
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Pan-Cosmic dispute',
    };
  }
}

/**
 * Server Action to verify proposed changes against constitutional invariants.
 */
export async function verifyPanCosmicInvariantAction(
  invariants: PanCosmicConstitutionalInvariant[],
  targetArticleCode: string
): Promise<PanCosmicInvariantActionResult> {
  try {
    const data = verifyPanCosmicConstitutionalInvariants(invariants, targetArticleCode);
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify Pan-Cosmic constitutional invariant',
    };
  }
}

/**
 * Server Action to execute 4096-bit Topological Braided STARK compaction and persist proof.
 */
export async function compactBraidedStarkStateAction(
  previousStateRoot: string,
  transactions: BraidedTransaction[]
): Promise<BraidedCompactionActionResult> {
  try {
    const data = compactStateWithBraidedStark(previousStateRoot, transactions);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO braided_stark_compaction_proofs (
             id, proof_ref, batch_transaction_count, previous_state_root,
             new_state_root, stark_proof_bytes_length, verification_time_micros,
             verifier_circuit_identifier, is_mathematically_sound, verified_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `BRAID-PROOF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact braided STARK state',
    };
  }
}
