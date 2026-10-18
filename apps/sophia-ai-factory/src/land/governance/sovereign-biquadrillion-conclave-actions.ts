'use server';

/**
 * @file sovereign-biquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Bi-Quadrillion Conclave arbitration, constitutional invariant checks, and 33,554,432-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
} from './sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignBiquadrillionConclaveDispute,
  verifyBiquadrillionEmpireConstitutionalInvariants,
  type BiquadrillionDisputeInput,
  type BiquadrillionDisputeRuling,
  type BiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-biquadrillion-conclave-engine';
import {
  compactStateWithBiquadrillionBraidedStark,
  type BiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/biquadrillion-braided-stark-engine';
import type {
  BiquadrillionEmpireConstitutionalInvariant,
  BiquadrillionEmpireTransaction,
} from '@/seed/types/biquadrillion-braided-stark-conclave';

export interface SovereignBiquadrillionDisputeActionResult {
  success: boolean;
  data?: BiquadrillionDisputeRuling;
  error?: string;
}

export interface BiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: BiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface BiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: BiquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Bi-Quadrillion dispute via Sovereign Conclave (99.9999999999% consensus).
 */
export async function arbitrateSovereignBiquadrillionDisputeAction(
  input: BiquadrillionDisputeInput
): Promise<SovereignBiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignBiquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'biquadrillion',
      ...input,
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to compact 800,000,000,000 transactions into a 64-byte root via 33,554,432-bit STARK.
 */
export async function compactStateWithBiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: BiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<BiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithBiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'biquadrillion',
      batchRefPrefix: 'BIQUAD-STARK-BATCH',
      ...data,
    });
    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify adherence to Bi-Quadrillion Empire Constitutional Invariants.
 */
export async function verifyBiquadrillionEmpireInvariantAction(
  invariantsOrCode: BiquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): Promise<BiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyBiquadrillionEmpireConstitutionalInvariants(
      invariantsOrCode,
      proposedTargetArticleCode
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
