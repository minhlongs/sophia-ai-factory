'use server';

/**
 * @file pan-dimensional-empire-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Pan-Dimensional Empire Conclave arbitration, constitutional invariant checks, and STARK compaction.
 */

import {
  arbitratePanDimensionalEmpireConclaveDispute,
  verifyPanDimensionalEmpireConstitutionalInvariants,
  type PanDimensionalEmpireDisputeInput,
  type PanDimensionalEmpireDisputeRuling,
  type PanDimensionalEmpireInvariantCheckOutput,
} from '@/tree/governance/pan-dimensional-empire-conclave-engine';
import {
  compactStateWithPanDimensionalHolographicStark,
  type PanDimensionalHolographicStarkCompactionResult,
} from '@/tree/crypto/pan-dimensional-holographic-stark-engine';
import type {
  PanDimensionalEmpireConstitutionalInvariant,
  PanDimensionalEmpireTransaction,
} from '@/seed/types/pan-dimensional-holographic-stark-conclave';
import {
  recordCosmicConclaveDispute,
  recordCosmicStarkBatch,
} from './cosmic-court-d1-recorder';

export interface PanDimensionalEmpireDisputeActionResult {
  success: boolean;
  data?: PanDimensionalEmpireDisputeRuling;
  error?: string;
}

export interface PanDimensionalHolographicCompactionActionResult {
  success: boolean;
  data?: PanDimensionalHolographicStarkCompactionResult;
  error?: string;
}

/**
 * Server Action to arbitrate a Pan-Dimensional dispute via Supreme Conclave (99.999999% consensus).
 */
export async function arbitratePanDimensionalEmpireDisputeAction(
  input: PanDimensionalEmpireDisputeInput
): Promise<PanDimensionalEmpireDisputeActionResult> {
  try {
    const data = arbitratePanDimensionalEmpireConclaveDispute(input);
    await recordCosmicConclaveDispute({
      tableName: 'pan_dimensional_supreme_conclave_disputes',
      disputeCaseRef: input.disputeCaseRef,
      claimantParticipantId: input.claimantParticipantId,
      respondentParticipantId: input.respondentParticipantId,
      disputeValueCents: input.disputeValueCents,
      evidenceSha256: input.evidenceSha256,
      totalJurors: data.totalJurors,
      claimantVotes: data.claimantVotes,
      respondentVotes: data.respondentVotes,
      effectiveSupermajorityPct: data.effectiveSupermajorityPct,
      jurorsSlashedCount: data.jurorsSlashedCount,
      totalSlashedStakeCents: data.totalSlashedStakeCents,
      executedRemedyCents: data.executedRemedyCents,
      verdict: data.verdict,
      rulingHash: data.rulingHash,
    });

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Pan-Dimensional Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 2,097,152-bit STARK proof.
 */
export async function compactPanDimensionalHolographicStateAction(
  previousStateRoot: string,
  transactions: PanDimensionalEmpireTransaction[],
  circuitIdentifier: string = 'PAN_DIMENSIONAL_HOLOGRAPHIC_STARK_2097152_RECURSIVE_40B_V1'
): Promise<PanDimensionalHolographicCompactionActionResult> {
  try {
    const data = compactStateWithPanDimensionalHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordCosmicStarkBatch({
      tableName: 'pan_dimensional_holographic_stark_batches',
      batchRefPrefix: 'STARK-PAN',
      newStateColumn: 'new_state_root',
      timeColumn: 'verification_time_nanos',
      batchTransactionCount: data.batchTransactionCount,
      previousStateRoot: data.previousStateRoot,
      newStateRoot: data.newStateRoot,
      starkProofBytesLength: data.starkProofBytesLength,
      verificationTime: data.verificationTimeNanos,
      verifierCircuitIdentifier: data.verifierCircuitIdentifier,
      isMathematicallySound: data.isMathematicallySound,
      compactionDigest: data.compactionDigest,
    });

    return { success: data.isMathematicallySound, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact Pan-Dimensional STARK state',
    };
  }
}

/**
 * Server Action to check invariant preservation against the Pan-Dimensional Empire Constitutional Charter.
 */
export async function verifyPanDimensionalEmpireInvariantsAction(
  invariants: PanDimensionalEmpireConstitutionalInvariant[],
  targetArticleCode: string
): Promise<{ success: boolean; data: PanDimensionalEmpireInvariantCheckOutput }> {
  const data = verifyPanDimensionalEmpireConstitutionalInvariants(invariants, targetArticleCode);
  return {
    success: data.allowed,
    data,
  };
}
