'use server';

/**
 * @file pan-dimensional-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Pan-Dimensional Conclave arbitration, constitutional invariant checks, and STARK compaction.
 */

import {
  arbitratePanDimensionalConclaveDispute,
  verifyPanDimensionalConstitutionalInvariants,
  type PanDimensionalDisputeInput,
} from '@/tree/governance/pan-dimensional-supreme-conclave-engine';
import { compactStateWithPanDimensionalStark } from '@/tree/crypto/pan-dimensional-stark-engine';
import type {
  PanDimensionalConstitutionalInvariant,
  PanDimensionalTransaction,
} from '@/seed/types/pan-dimensional-stark-conclave';
import {
  DEFAULT_CONSTITUTIONAL_INVARIANTS,
  persistPanDimensionalArbitration,
  persistPanDimensionalStarkCompactionProof,
  type PanDimensionalDisputeActionResult,
  type PanDimensionalInvariantActionResult,
  type PanDimensionalStarkCompactionActionResult,
} from './pan-dimensional-conclave-persistence';

export type {
  PanDimensionalDisputeActionResult,
  PanDimensionalInvariantActionResult,
  PanDimensionalStarkCompactionActionResult,
} from './pan-dimensional-conclave-persistence';

/**
 * Server Action to arbitrate dispute via Pan-Dimensional Supreme Conclave (99.999% supermajority threshold, 99.5% slash).
 */
export async function arbitratePanDimensionalDisputeAction(
  params: PanDimensionalDisputeInput
): Promise<PanDimensionalDisputeActionResult> {
  try {
    const data = arbitratePanDimensionalConclaveDispute(params);
    await persistPanDimensionalArbitration(params, data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Pan-Dimensional dispute',
    };
  }
}

/**
 * Server Action to test if proposed target article code violates immutable Pan-Dimensional constitutional invariants.
 */
export async function verifyPanDimensionalInvariantAction(
  targetArticleCode: string,
  customInvariants?: PanDimensionalConstitutionalInvariant[]
): Promise<PanDimensionalInvariantActionResult> {
  try {
    const invariants = customInvariants ?? DEFAULT_CONSTITUTIONAL_INVARIANTS;
    const data = verifyPanDimensionalConstitutionalInvariants(invariants, targetArticleCode);
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify constitutional invariant',
    };
  }
}

/**
 * Server Action to execute 262,144-bit Non-Archimedean Pan-Dimensional STARK compaction (4B transactions) and persist proof.
 */
export async function compactPanDimensionalStarkStateAction(
  previousStateRoot: string,
  transactions: PanDimensionalTransaction[],
  circuitIdentifier?: string
): Promise<PanDimensionalStarkCompactionActionResult> {
  try {
    const data = compactStateWithPanDimensionalStark(
      previousStateRoot,
      transactions,
      circuitIdentifier ?? 'PAN_DIMENSIONAL_STARK_262144_RECURSIVE_4B_V1'
    );
    await persistPanDimensionalStarkCompactionProof(data);
    return { success: data.isMathematicallySound, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Pan-Dimensional STARK compaction',
    };
  }
}
