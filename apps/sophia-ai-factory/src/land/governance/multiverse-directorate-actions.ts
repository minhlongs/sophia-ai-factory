'use server';

/**
 * @file multiverse-directorate-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Multiverse Constitutional Directorate arbitration and invariant verification.
 */

import {
  arbitrateMultiverseDispute,
  verifyMultiverseConstitutionalInvariants,
  type MultiverseDisputeInput,
  type MultiverseInvariantCheckOutput,
  type MultiverseDirectorateVerdictOutput,
} from '@/tree/governance/multiverse-directorate-engine';
import {
  compactStateWithAnyonicStark,
  type AnyonicStarkCompactionResult,
} from '@/tree/crypto/anyonic-stark-compaction-engine';
import type {
  AnyonicTransaction,
  MultiverseConstitutionalInvariant,
} from '@/seed/types/anyonic-stark-directorate';
import {
  persistMultiverseArbitration,
  persistAnyonicCompactionProof,
} from './multiverse-directorate-persistence';

export interface MultiverseDisputeActionResult {
  success: boolean;
  data?: MultiverseDirectorateVerdictOutput;
  error?: string;
}

export interface AnyonicStarkCompactionActionResult {
  success: boolean;
  data?: AnyonicStarkCompactionResult;
  error?: string;
}

export interface InvariantCheckActionResult {
  success: boolean;
  data?: MultiverseInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a multiverse commercial dispute and persist the ruling.
 */
export async function arbitrateMultiverseDisputeAction(
  params: MultiverseDisputeInput
): Promise<MultiverseDisputeActionResult> {
  try {
    const data = arbitrateMultiverseDispute(params);
    await persistMultiverseArbitration(params, data);
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Multiverse dispute arbitration failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to compact 20,000,000 transactions into a 64-byte post-quantum Anyonic root.
 */
export async function compactAnyonicTransactionsAction(
  previousStateRoot: string,
  transactions: AnyonicTransaction[],
  circuitIdentifier: string = 'ANYONIC_STARK_BRAIDED_RECURSIVE_20M_V1'
): Promise<AnyonicStarkCompactionActionResult> {
  try {
    const data = compactStateWithAnyonicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await persistAnyonicCompactionProof(data);
    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Anyonic STARK compaction failed';
    return { success: false, error: message };
  }
}

/**
 * Server Action to verify proposed mutations against immutable constitutional invariants.
 */
export async function verifyMultiverseInvariantCharterAction(
  invariants: MultiverseConstitutionalInvariant[],
  proposedTargetArticleCode: string
): Promise<InvariantCheckActionResult> {
  try {
    const data = verifyMultiverseConstitutionalInvariants(
      invariants,
      proposedTargetArticleCode
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invariant verification failed';
    return { success: false, error: message };
  }
}
