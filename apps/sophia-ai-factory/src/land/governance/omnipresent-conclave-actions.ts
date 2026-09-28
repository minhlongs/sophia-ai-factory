'use server';

/**
 * @file omnipresent-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omnipresent Conclave arbitration, constitutional invariant checks, and Braided STARK compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitrateOmnipresentConclaveDispute,
  verifyOmnipresentConstitutionalInvariants,
  type OmnipresentDisputeInput,
  type OmnipresentDisputeRuling,
  type OmnipresentInvariantCheckOutput,
} from '@/tree/governance/omnipresent-conclave-engine';
import {
  compactStateWithBraidedStark,
  type BraidedStarkCompactionResult,
} from '@/tree/crypto/braided-stark-engine';
import type {
  OmnipresentConstitutionalInvariant,
  BraidedTransaction,
} from '@/seed/types/braided-stark-conclave';

export interface OmnipresentDisputeActionResult {
  success: boolean;
  data?: OmnipresentDisputeRuling;
  error?: string;
}

export interface OmnipresentInvariantActionResult {
  success: boolean;
  data?: OmnipresentInvariantCheckOutput;
  error?: string;
}

export interface BraidedStarkCompactionActionResult {
  success: boolean;
  data?: BraidedStarkCompactionResult;
  error?: string;
}

const DEFAULT_CONSTITUTIONAL_INVARIANTS: OmnipresentConstitutionalInvariant[] = [
  {
    articleCode: 'ART-001-IRREVOCABLE-FINALITY',
    articleTitle: 'Sub-200ps Quantum Settlement Irrevocability',
    isStrictlyImmutable: true,
    enforcementCircuitHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    lastTheoremVerifiedAt: new Date().toISOString(),
  },
  {
    articleCode: 'ART-002-BASEL-XIV-SOLVENCY',
    articleTitle: 'Basel XIV Capital Solvency Invariance (CET1 >= 40.00%)',
    isStrictlyImmutable: true,
    enforcementCircuitHash: 'b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01',
    lastTheoremVerifiedAt: new Date().toISOString(),
  },
  {
    articleCode: 'ART-003-NINETEEN-NINES-SLA',
    articleTitle: 'Nineteen-Nines (99.99999999999999999%) SLA Guarantee',
    isStrictlyImmutable: true,
    enforcementCircuitHash: 'c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef012',
    lastTheoremVerifiedAt: new Date().toISOString(),
  },
];

/**
 * Server Action to arbitrate dispute via Omnipresent Supreme Conclave (99.95% supermajority threshold, 95% slash).
 */
export async function arbitrateOmnipresentDisputeAction(
  params: OmnipresentDisputeInput
): Promise<OmnipresentDisputeActionResult> {
  try {
    const data = arbitrateOmnipresentConclaveDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO omnipresent_conclave_arbitrations (
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
          params.supermajorityThresholdPct ?? 99.95,
          data.verdict,
          data.jurorsSlashedCount,
          data.executedRemedyCents,
          data.verdict !== 'DELIBERATING' ? new Date().toISOString() : null
        )
        .run();
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Omnipresent dispute',
    };
  }
}

/**
 * Server Action to test if proposed target article code violates immutable Omnipresent constitutional invariants.
 */
export async function verifyOmnipresentInvariantAction(
  targetArticleCode: string,
  customInvariants?: OmnipresentConstitutionalInvariant[]
): Promise<OmnipresentInvariantActionResult> {
  try {
    const invariants = customInvariants ?? DEFAULT_CONSTITUTIONAL_INVARIANTS;
    const data = verifyOmnipresentConstitutionalInvariants(invariants, targetArticleCode);
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify constitutional invariant',
    };
  }
}

/**
 * Server Action to execute 65,536-bit Non-Archimedean Braided STARK compaction (800M transactions) and persist proof.
 */
export async function compactBraidedStarkStateAction(
  previousStateRoot: string,
  transactions: BraidedTransaction[],
  circuitIdentifier?: string
): Promise<BraidedStarkCompactionActionResult> {
  try {
    const data = compactStateWithBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier ?? 'BRAIDED_STARK_65536_RECURSIVE_800M_V1'
    );
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
          `BRAID-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      error: error instanceof Error ? error.message : 'Failed to execute Braided STARK compaction',
    };
  }
}
