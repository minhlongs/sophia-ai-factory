'use server';

/**
 * @file galactic-high-tribunal-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Galactic Constitutional High Tribunal arbitration and invariant verification.
 */

import {
  arbitrateGalacticDispute,
  verifyGalacticConstitutionalInvariants,
  type GalacticDisputeInput,
  type GalacticInvariantCheckOutput,
  type GalacticTribunalVerdictOutput,
} from '@/tree/governance/galactic-high-tribunal-engine';
import {
  compactStateWithHolographicStark,
  type HolographicStarkCompactionResult,
} from '@/tree/crypto/holographic-stark-compaction-engine';
import type {
  GalacticConstitutionalInvariant,
  HolographicTransaction,
} from '@/seed/types/holographic-stark-tribunal';
import {
  persistGalacticArbitration,
  persistHolographicCompactionProof,
} from './galactic-high-tribunal-persistence';

export interface GalacticDisputeActionResult {
  success: boolean;
  data?: GalacticTribunalVerdictOutput;
  error?: string;
}

export interface HolographicStarkCompactionActionResult {
  success: boolean;
  data?: HolographicStarkCompactionResult;
  error?: string;
}

export interface InvariantCheckActionResult {
  success: boolean;
  data?: GalacticInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a galactic commercial dispute and persist the ruling.
 */
export async function arbitrateGalacticDisputeAction(
  params: GalacticDisputeInput
): Promise<GalacticDisputeActionResult> {
  try {
    const data = arbitrateGalacticDispute(params);
    await persistGalacticArbitration(params, data);
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Galactic dispute arbitration failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to compact 10,000,000 transactions into a 64-byte post-quantum Holographic root.
 */
export async function compactHolographicTransactionsAction(
  previousStateRoot: string,
  transactions: HolographicTransaction[],
  circuitIdentifier: string = 'HOLOGRAPHIC_STARK_FRI_RECURSIVE_10M_V1'
): Promise<HolographicStarkCompactionActionResult> {
  try {
    const data = compactStateWithHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await persistHolographicCompactionProof(data);
    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Holographic STARK compaction failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to verify proposed mutations against immutable constitutional invariants.
 */
export async function verifyGalacticInvariantCharterAction(
  invariants: GalacticConstitutionalInvariant[],
  proposedTargetArticleCode: string
): Promise<InvariantCheckActionResult> {
  try {
    const data = verifyGalacticConstitutionalInvariants(
      invariants,
      proposedTargetArticleCode
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invariant verification failed';
    return { success: false, error: message };
  }
}
