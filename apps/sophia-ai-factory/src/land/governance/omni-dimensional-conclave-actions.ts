'use server';

/**
 * @file omni-dimensional-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omni-Dimensional Conclave arbitration, constitutional invariant checks, and STARK compaction.
 */

import {
  arbitrateOmniDimensionalConclaveDispute,
  verifyOmniDimensionalConstitutionalInvariants,
  type OmniDimensionalDisputeInput,
  type OmniDimensionalDisputeRuling,
  type OmniDimensionalInvariantCheckOutput,
} from '@/tree/governance/omni-dimensional-supreme-conclave-engine';
import {
  compactStateWithOmniDimensionalStark,
  type OmniDimensionalStarkCompactionResult,
} from '@/tree/crypto/omni-dimensional-stark-engine';
import type {
  OmniDimensionalConstitutionalInvariant,
  OmniDimensionalTransaction,
} from '@/seed/types/omni-dimensional-stark-conclave';
import {
  recordCosmicConclaveDispute,
  recordCosmicStarkBatch,
} from './cosmic-court-d1-recorder';

export interface OmniDimensionalDisputeActionResult {
  success: boolean;
  data?: OmniDimensionalDisputeRuling;
  error?: string;
}

export interface OmniDimensionalCompactionActionResult {
  success: boolean;
  data?: OmniDimensionalStarkCompactionResult;
  error?: string;
}

/**
 * Server Action to arbitrate an Omni-Dimensional dispute via Supreme Conclave (99.9999% consensus).
 */
export async function arbitrateOmniDimensionalDisputeAction(
  input: OmniDimensionalDisputeInput
): Promise<OmniDimensionalDisputeActionResult> {
  try {
    const data = arbitrateOmniDimensionalConclaveDispute(input);
    await recordCosmicConclaveDispute({
      tableName: 'omni_dimensional_conclave_disputes',
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
      error: error instanceof Error ? error.message : 'Failed to arbitrate Omni-Dimensional Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 524,288-bit STARK proof.
 */
export async function compactOmniDimensionalStateAction(
  previousStateRoot: string,
  transactions: OmniDimensionalTransaction[],
  circuitIdentifier: string = 'OMNI_DIMENSIONAL_STARK_524288_RECURSIVE_10B_V1'
): Promise<OmniDimensionalCompactionActionResult> {
  try {
    const data = compactStateWithOmniDimensionalStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordCosmicStarkBatch({
      tableName: 'omni_dimensional_stark_batches',
      batchRefPrefix: 'STARK-OMNI',
      newStateColumn: 'new_state_root',
      timeColumn: 'verification_time_micros',
      batchTransactionCount: data.batchTransactionCount,
      previousStateRoot: data.previousStateRoot,
      newStateRoot: data.newStateRoot,
      starkProofBytesLength: data.starkProofBytesLength,
      verificationTime: data.verificationTimeMicros,
      verifierCircuitIdentifier: data.verifierCircuitIdentifier,
      isMathematicallySound: data.isMathematicallySound,
      compactionDigest: data.compactionDigest,
    });

    return { success: data.isMathematicallySound, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact Omni-Dimensional STARK state',
    };
  }
}

/**
 * Server Action to check invariant preservation against the Omni-Dimensional Constitutional Charter.
 */
export async function verifyOmniDimensionalInvariantsAction(
  invariants: OmniDimensionalConstitutionalInvariant[],
  targetArticleCode: string
): Promise<{ success: boolean; data: OmniDimensionalInvariantCheckOutput }> {
  const data = verifyOmniDimensionalConstitutionalInvariants(invariants, targetArticleCode);
  return {
    success: data.allowed,
    data,
  };
}
