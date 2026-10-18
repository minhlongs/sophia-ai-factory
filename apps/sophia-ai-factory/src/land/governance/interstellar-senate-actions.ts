'use server';

/**
 * @file interstellar-senate-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Interstellar Supreme Senate arbitration and invariant verification.
 */

import {
  arbitrateInterstellarDispute,
  verifyInterstellarConstitutionalInvariants,
  type InterstellarDisputeInput,
  type InterstellarInvariantCheckOutput,
  type InterstellarSenateVerdictOutput,
} from '@/tree/governance/interstellar-senate-engine';
import { compactStateWithHyperStark, type HyperStarkCompactionResult } from '@/tree/crypto/hyper-stark-compaction-engine';
import type { HyperStarkTransaction, InterstellarConstitutionalInvariant } from '@/seed/types/hyper-stark-senate';
import {
  persistArbitrationRuling,
  persistHyperStarkCompactionProof,
} from './interstellar-senate-persistence';

export interface InterstellarDisputeActionResult {
  success: boolean;
  data?: InterstellarSenateVerdictOutput;
  error?: string;
}

export interface HyperStarkCompactionActionResult {
  success: boolean;
  data?: HyperStarkCompactionResult;
  error?: string;
}

export interface InvariantCheckActionResult {
  success: boolean;
  data?: InterstellarInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate an interstellar commercial dispute and persist the ruling.
 */
export async function arbitrateInterstellarDisputeAction(
  params: InterstellarDisputeInput
): Promise<InterstellarDisputeActionResult> {
  try {
    const data = arbitrateInterstellarDispute(params);
    await persistArbitrationRuling(params, data);
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Interstellar Senate arbitration error',
    };
  }
}

/**
 * Server Action to generate Hyper-STARK commitment and execute recursive state compaction.
 */
export async function compactHyperStarkBatchAction(
  previousStateRoot: string,
  transactions: HyperStarkTransaction[],
  circuitIdentifier: string = 'HYPER_STARK_FRI_RECURSIVE_4M_V1'
): Promise<HyperStarkCompactionActionResult> {
  try {
    const data = compactStateWithHyperStark(previousStateRoot, transactions, circuitIdentifier);
    await persistHyperStarkCompactionProof(data);
    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Hyper-STARK compaction error',
    };
  }
}

/**
 * Server Action to verify proposed legislative amendment against immutable constitutional charter.
 */
export async function verifyConstitutionalAmendmentAction(
  proposedArticleCode: string,
  invariants: InterstellarConstitutionalInvariant[]
): Promise<InvariantCheckActionResult> {
  try {
    const data = verifyInterstellarConstitutionalInvariants(invariants, proposedArticleCode);
    return { success: data.allowed, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown constitutional verification error',
    };
  }
}
