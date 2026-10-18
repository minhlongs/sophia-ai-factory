'use server';

/**
 * @file inter-galactic-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omni-Cosmic Conclave arbitration, constitutional invariant checks, and STARK compaction.
 */

import {
  arbitrateInterGalacticConclaveDispute,
  verifyInterGalacticConstitutionalInvariants,
  type InterGalacticDisputeInput,
  type InterGalacticDisputeRuling,
  type InterGalacticInvariantCheckOutput,
} from '@/tree/governance/inter-galactic-supreme-conclave-engine';
import {
  compactStateWithInterGalacticStark,
  type InterGalacticStarkCompactionResult,
} from '@/tree/crypto/inter-galactic-stark-engine';
import type {
  InterGalacticConstitutionalInvariant,
  InterGalacticTransaction,
} from '@/seed/types/inter-galactic-stark-conclave';
import {
  recordCosmicConclaveDispute,
  recordCosmicStarkBatch,
} from './cosmic-court-d1-recorder';

export interface InterGalacticDisputeActionResult {
  success: boolean;
  data?: InterGalacticDisputeRuling;
  error?: string;
}

export interface InterGalacticCompactionActionResult {
  success: boolean;
  data?: InterGalacticStarkCompactionResult;
  error?: string;
}

/**
 * Server Action to arbitrate an Inter-Galactic dispute via Supreme Conclave (99.99999% consensus).
 */
export async function arbitrateInterGalacticDisputeAction(
  input: InterGalacticDisputeInput
): Promise<InterGalacticDisputeActionResult> {
  try {
    const data = arbitrateInterGalacticConclaveDispute(input);
    await recordCosmicConclaveDispute({
      tableName: 'inter_galactic_conclave_disputes',
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
      error: error instanceof Error ? error.message : 'Failed to arbitrate Inter-Galactic Conclave dispute',
    };
  }
}

/**
 * Server Action to compact transactions into a 64-byte state root via 1,048,576-bit STARK proof.
 */
export async function compactInterGalacticStateAction(
  previousStateRoot: string,
  transactions: InterGalacticTransaction[],
  circuitIdentifier: string = 'INTER_GALACTIC_STARK_1048576_RECURSIVE_20B_V1'
): Promise<InterGalacticCompactionActionResult> {
  try {
    const data = compactStateWithInterGalacticStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordCosmicStarkBatch({
      tableName: 'inter_galactic_stark_batches',
      batchRefPrefix: 'STARK-IG',
      newStateColumn: 'newStateRoot',
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
      error: error instanceof Error ? error.message : 'Failed to compact Inter-Galactic STARK state',
    };
  }
}

/**
 * Server Action to check invariant preservation against the Inter-Galactic Constitutional Charter.
 */
export async function verifyInterGalacticInvariantsAction(
  invariants: InterGalacticConstitutionalInvariant[],
  targetArticleCode: string
): Promise<{ success: boolean; data: InterGalacticInvariantCheckOutput }> {
  const data = verifyInterGalacticConstitutionalInvariants(invariants, targetArticleCode);
  return {
    success: data.allowed,
    data,
  };
}
