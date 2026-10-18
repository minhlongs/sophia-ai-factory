'use server';

/**
 * @file planetary-court-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for zk-SNARK state compaction and Planetary Constitutional Court arbitration.
 */

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
import { recordCourtCompactionProof } from './cosmic-court-d1-recorder';
import { persistPlanetaryArbitration } from './court-arbitration-d1-recorder';

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
    await recordCourtCompactionProof({
      tableName: 'zk_state_compaction_proofs',
      id: `zk_${Date.now()}`,
      proofRef,
      proofLengthColumn: 'snark_proof_bytes_length',
      batchTransactionCount: data.batchTransactionCount,
      previousStateRoot: data.previousStateRoot,
      newStateRoot: data.newStateRoot,
      proofBytesLength: data.snarkProofBytesLength,
      verificationTimeMicros: data.verificationTimeMicros,
      verifierCircuitIdentifier: data.verifierCircuitIdentifier,
      isMathematicallySound: data.isMathematicallySound,
    });

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
    await persistPlanetaryArbitration(params, data);
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
