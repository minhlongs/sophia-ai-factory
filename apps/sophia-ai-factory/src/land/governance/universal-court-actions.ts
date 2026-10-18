'use server';

/**
 * @file universal-court-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for zk-STARK state compaction and Universal Constitutional Court arbitration.
 */

import {
  compactStateWithZkStark,
  type ZkStarkCompactionResult,
} from '@/tree/crypto/zk-stark-compaction-engine';
import {
  arbitrateUniversalDispute,
  verifyUniversalConstitutionalInvariants,
  type UniversalCourtVerdictOutput,
  type UniversalDisputeInput,
  type UniversalInvariantCheckOutput,
} from '@/tree/governance/universal-court-engine';
import type {
  StarkTransaction,
  UniversalConstitutionalInvariant,
} from '@/seed/types/zk-stark-constitution';
import { recordCourtCompactionProof } from './cosmic-court-d1-recorder';
import { persistUniversalArbitration } from './court-arbitration-d1-recorder';

export interface ZkStarkCompactActionResult {
  success: boolean;
  data?: ZkStarkCompactionResult;
  error?: string;
}

export interface UniversalCourtActionResult {
  success: boolean;
  data?: UniversalCourtVerdictOutput;
  error?: string;
}

export interface UniversalInvariantActionResult {
  success: boolean;
  data?: UniversalInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to compact 2,000,000 transactions into a 64-byte STARK root and record proof.
 */
export async function compactZkStarkStateAction(
  previousStateRoot: string,
  transactions: StarkTransaction[],
  proofRef: string = `STARK_PROOF_${Date.now()}`
): Promise<ZkStarkCompactActionResult> {
  try {
    const data = compactStateWithZkStark(previousStateRoot, transactions);
    await recordCourtCompactionProof({
      tableName: 'zk_stark_compaction_proofs',
      id: `stark_${Date.now()}`,
      proofRef,
      proofLengthColumn: 'stark_proof_bytes_length',
      batchTransactionCount: data.batchTransactionCount,
      previousStateRoot: data.previousStateRoot,
      newStateRoot: data.newStateRoot,
      proofBytesLength: data.starkProofBytesLength,
      verificationTimeMicros: data.verificationTimeMicros,
      verifierCircuitIdentifier: data.verifierCircuitIdentifier,
      isMathematicallySound: data.isMathematicallySound,
    });

    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown zk-STARK compaction failure',
    };
  }
}

/**
 * Server Action to arbitrate disputes before the Universal Supreme Court and persist ruling.
 */
export async function arbitrateUniversalDisputeAction(
  params: UniversalDisputeInput
): Promise<UniversalCourtActionResult> {
  try {
    const data = arbitrateUniversalDispute(params);
    await persistUniversalArbitration(params, data);
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown universal court failure',
    };
  }
}

/**
 * Server Action to verify universal constitutional immutability.
 */
export async function verifyUniversalInvariantAction(
  invariants: UniversalConstitutionalInvariant[],
  articleCode: string
): Promise<UniversalInvariantActionResult> {
  try {
    const data = verifyUniversalConstitutionalInvariants(invariants, articleCode);
    return { success: data.allowed, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown universal invariant failure',
    };
  }
}
