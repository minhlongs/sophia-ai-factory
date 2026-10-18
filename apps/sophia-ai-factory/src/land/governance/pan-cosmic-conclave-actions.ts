'use server';

/**
 * @file pan-cosmic-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Pan-Cosmic Constitutional Conclave Arbitration and 4096-Bit Braided STARK.
 */

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
import { recordCourtCompactionProof } from './cosmic-court-d1-recorder';
import { persistPanCosmicArbitration } from './court-arbitration-d1-recorder';

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
    await persistPanCosmicArbitration(params, data);
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
    await recordCourtCompactionProof({
      tableName: 'braided_stark_compaction_proofs',
      id: crypto.randomUUID(),
      proofRef: `BRAID-PROOF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      proofLengthColumn: 'stark_proof_bytes_length',
      batchTransactionCount: data.batchTransactionCount,
      previousStateRoot: data.previousStateRoot,
      newStateRoot: data.newStateRoot,
      proofBytesLength: data.starkProofBytesLength,
      verificationTimeMicros: data.verificationTimeMicros,
      verifierCircuitIdentifier: data.verifierCircuitIdentifier,
      isMathematicallySound: data.isMathematicallySound,
      includeVerifiedAt: true,
    });

    return { success: data.isMathematicallySound, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compact braided STARK state',
    };
  }
}
