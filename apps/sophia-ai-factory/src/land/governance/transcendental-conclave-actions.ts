'use server';

/**
 * @file transcendental-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Transcendental Conclave arbitration, constitutional invariant checks, and Trans-Cosmic STARK compaction.
 */

import {
  arbitrateTranscendentalConclaveDispute,
  verifyTranscendentalConstitutionalInvariants,
  type TranscendentalDisputeInput,
} from '@/tree/governance/transcendental-conclave-engine';
import { compactStateWithTransCosmicStark } from '@/tree/crypto/trans-cosmic-stark-engine';
import type {
  TranscendentalConstitutionalInvariant,
  TransCosmicTransaction,
} from '@/seed/types/trans-cosmic-stark-conclave';
import {
  DEFAULT_CONSTITUTIONAL_INVARIANTS,
  persistTransCosmicStarkCompactionProof,
  persistTranscendentalArbitration,
  type TransCosmicStarkCompactionActionResult,
  type TranscendentalDisputeActionResult,
  type TranscendentalInvariantActionResult,
} from './transcendental-conclave-persistence';

export type {
  TranscendentalDisputeActionResult,
  TranscendentalInvariantActionResult,
  TransCosmicStarkCompactionActionResult,
} from './transcendental-conclave-persistence';

/**
 * Server Action to arbitrate dispute via Transcendental Supreme Conclave (99.99% supermajority threshold, 99% slash).
 */
export async function arbitrateTranscendentalDisputeAction(
  params: TranscendentalDisputeInput
): Promise<TranscendentalDisputeActionResult> {
  try {
    const data = arbitrateTranscendentalConclaveDispute(params);
    await persistTranscendentalArbitration(params, data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to arbitrate Transcendental dispute',
    };
  }
}

/**
 * Server Action to test if proposed target article code violates immutable Transcendental constitutional invariants.
 */
export async function verifyTranscendentalInvariantAction(
  targetArticleCode: string,
  customInvariants?: TranscendentalConstitutionalInvariant[]
): Promise<TranscendentalInvariantActionResult> {
  try {
    const invariants = customInvariants ?? DEFAULT_CONSTITUTIONAL_INVARIANTS;
    const data = verifyTranscendentalConstitutionalInvariants(invariants, targetArticleCode);
    return { success: data.allowed, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify constitutional invariant',
    };
  }
}

/**
 * Server Action to execute 131,072-bit Non-Archimedean Trans-Cosmic STARK compaction (2B transactions) and persist proof.
 */
export async function compactTransCosmicStarkStateAction(
  previousStateRoot: string,
  transactions: TransCosmicTransaction[],
  circuitIdentifier?: string
): Promise<TransCosmicStarkCompactionActionResult> {
  try {
    const data = compactStateWithTransCosmicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier ?? 'TRANS_COSMIC_STARK_131072_RECURSIVE_2B_V1'
    );
    await persistTransCosmicStarkCompactionProof(data);
    return { success: data.isMathematicallySound, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Trans-Cosmic STARK compaction',
    };
  }
}
