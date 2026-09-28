'use server';

/**
 * @file pan-dimensional-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Pan-Dimensional Conclave arbitration, constitutional invariant checks, and Topological STARK compaction.
 */

import { getD1 } from '@/seed/db/client';
import {
  arbitratePanDimensionalConclaveDispute,
  verifyPanDimensionalConstitutionalInvariants,
  type PanDimensionalDisputeInput,
  type PanDimensionalDisputeRuling,
  type PanDimensionalInvariantCheckOutput,
} from '@/tree/governance/pan-dimensional-conclave-engine';
import {
  compactStateWithTopologicalStark,
  type TopologicalStarkCompactionResult,
} from '@/tree/crypto/topological-stark-engine';
import type {
  PanDimensionalConstitutionalInvariant,
  TopologicalTransaction,
} from '@/seed/types/topological-stark-conclave';

export interface PanDimensionalDisputeActionResult {
  success: boolean;
  data?: PanDimensionalDisputeRuling;
  error?: string;
}

export interface PanDimensionalInvariantActionResult {
  success: boolean;
  data?: PanDimensionalInvariantCheckOutput;
  error?: string;
}

export interface TopologicalStarkCompactionActionResult {
  success: boolean;
  data?: TopologicalStarkCompactionResult;
  error?: string;
}

const DEFAULT_CONSTITUTIONAL_INVARIANTS: PanDimensionalConstitutionalInvariant[] = [
  {
    articleCode: 'ART-001-IRREVOCABLE-FINALITY',
    articleTitle: 'Sub-500ps Quantum Settlement Irrevocability',
    isStrictlyImmutable: true,
    enforcementCircuitHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    lastTheoremVerifiedAt: new Date().toISOString(),
  },
  {
    articleCode: 'ART-002-BASEL-XIII-SOLVENCY',
    articleTitle: 'Basel XIII Capital Solvency Invariance (CET1 >= 38.00%)',
    isStrictlyImmutable: true,
    enforcementCircuitHash: 'b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01',
    lastTheoremVerifiedAt: new Date().toISOString(),
  },
  {
    articleCode: 'ART-003-EIGHTEEN-NINES-SLA',
    articleTitle: 'Eighteen-Nines (99.9999999999999999%) SLA Guarantee',
    isStrictlyImmutable: true,
    enforcementCircuitHash: 'c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef012',
    lastTheoremVerifiedAt: new Date().toISOString(),
  },
];

/**
 * Server Action to arbitrate dispute via Pan-Dimensional Supreme Conclave (99.9% supermajority threshold, 90% slash).
 */
export async function arbitratePanDimensionalDisputeAction(
  params: PanDimensionalDisputeInput
): Promise<PanDimensionalDisputeActionResult> {
  try {
    const data = arbitratePanDimensionalConclaveDispute(params);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO pan_dimensional_conclave_arbitrations (
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
          params.supermajorityThresholdPct ?? 99.9,
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
      error: error instanceof Error ? error.message : 'Failed to arbitrate pan-dimensional dispute',
    };
  }
}

/**
 * Server Action to verify proposed action against immutable Pan-Dimensional constitutional invariants.
 */
export async function verifyPanDimensionalInvariantAction(
  proposedArticleCode: string,
  invariants: PanDimensionalConstitutionalInvariant[] = DEFAULT_CONSTITUTIONAL_INVARIANTS
): Promise<PanDimensionalInvariantActionResult> {
  try {
    const data = verifyPanDimensionalConstitutionalInvariants(invariants, proposedArticleCode);
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify pan-dimensional constitutional invariant',
    };
  }
}

/**
 * Server Action to compact transactions into 64-byte Topological STARK state root and persist proof.
 */
export async function compactTopologicalStarkStateAction(
  previousStateRoot: string,
  transactions: TopologicalTransaction[],
  circuitIdentifier?: string
): Promise<TopologicalStarkCompactionActionResult> {
  try {
    const data = compactStateWithTopologicalStark(previousStateRoot, transactions, circuitIdentifier);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO topological_stark_compaction_proofs (
             id, proof_ref, batch_transaction_count, previous_state_root,
             new_state_root, stark_proof_bytes_length, verification_time_micros,
             verifier_circuit_identifier, is_mathematically_sound, verified_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          `TOPO-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      error: error instanceof Error ? error.message : 'Failed to compact Topological STARK state',
    };
  }
}
