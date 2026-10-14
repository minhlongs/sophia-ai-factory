'use server';

/**
 * @file omnipresent-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Omnipresent Conclave arbitration, constitutional invariant checks, and Braided STARK compaction.
 */

import {
  arbitrateOmnipresentConclaveDispute,
  verifyOmnipresentConstitutionalInvariants,
  type OmnipresentDisputeInput,
} from '@/tree/governance/omnipresent-conclave-engine';
import { compactStateWithBraidedStark } from '@/tree/crypto/braided-stark-engine';
import type {
  OmnipresentConstitutionalInvariant,
  BraidedTransaction,
} from '@/seed/types/braided-stark-conclave';
import {
  DEFAULT_CONSTITUTIONAL_INVARIANTS,
  persistBraidedStarkCompactionProof,
  persistOmnipresentArbitration,
  type BraidedStarkCompactionActionResult,
  type OmnipresentDisputeActionResult,
  type OmnipresentInvariantActionResult,
} from './omnipresent-conclave-persistence';

export type {
  OmnipresentDisputeActionResult,
  OmnipresentInvariantActionResult,
  BraidedStarkCompactionActionResult,
} from './omnipresent-conclave-persistence';

/**
 * Server Action to arbitrate dispute via Omnipresent Supreme Conclave (99.95% supermajority threshold, 95% slash).
 */
export async function arbitrateOmnipresentDisputeAction(
  params: OmnipresentDisputeInput
): Promise<OmnipresentDisputeActionResult> {
  try {
    const data = arbitrateOmnipresentConclaveDispute(params);
    await persistOmnipresentArbitration(params, data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Omnipresent dispute',
    };
  }
}

/**
 * Server Action to test if proposed target article code violates immutable Omnipresent constitutional invariants.
 */
export async function verifyOmnipresentInvariantAction(
  targetArticleCode: string,
  customInvariants?: OmnipresentConstitutionalInvariant[]
): Promise<OmnipresentInvariantActionResult> {
  try {
    const invariants = customInvariants ?? DEFAULT_CONSTITUTIONAL_INVARIANTS;
    const data = verifyOmnipresentConstitutionalInvariants(invariants, targetArticleCode);
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify constitutional invariant',
    };
  }
}

/**
 * Server Action to execute 65,536-bit Non-Archimedean Braided STARK compaction (800M transactions) and persist proof.
 */
export async function compactBraidedStarkStateAction(
  previousStateRoot: string,
  transactions: BraidedTransaction[],
  circuitIdentifier?: string
): Promise<BraidedStarkCompactionActionResult> {
  try {
    const data = compactStateWithBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier ?? 'BRAIDED_STARK_65536_RECURSIVE_800M_V1'
    );
    await persistBraidedStarkCompactionProof(data);
    return { success: data.isMathematicallySound, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Braided STARK compaction',
    };
  }
}
