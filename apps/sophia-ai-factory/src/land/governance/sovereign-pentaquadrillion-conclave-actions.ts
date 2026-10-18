'use server';

/**
 * @file sovereign-pentaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Penta-Quadrillion Conclave arbitration, constitutional invariant checks, and 67,108,864-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
} from './sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignPentaquadrillionConclaveDispute,
  verifyPentaquadrillionEmpireConstitutionalInvariants,
  type PentaquadrillionDisputeInput,
  type PentaquadrillionDisputeRuling,
  type PentaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-pentaquadrillion-conclave-engine';
import {
  compactStateWithPentaquadrillionBraidedStark,
  type PentaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/pentaquadrillion-braided-stark-engine';
import type {
  PentaquadrillionEmpireConstitutionalInvariant,
  PentaquadrillionEmpireTransaction,
} from '@/seed/types/pentaquadrillion-braided-stark-conclave';

export interface SovereignPentaquadrillionDisputeActionResult {
  success: boolean;
  data?: PentaquadrillionDisputeRuling;
  error?: string;
}

export interface PentaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: PentaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface PentaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: PentaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Penta-Quadrillion dispute via Sovereign Conclave (99.99999999999% consensus).
 */
export async function arbitrateSovereignPentaquadrillionDisputeAction(
  input: PentaquadrillionDisputeInput
): Promise<SovereignPentaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignPentaquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'pentaquadrillion',
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
 * Server Action to compact 2,000,000,000,000 transactions into a 64-byte root via 67,108,864-bit STARK.
 */
export async function compactStateWithPentaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: PentaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<PentaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithPentaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'pentaquadrillion',
      batchRefPrefix: 'PENTA-STARK-BATCH',
      ...data,
    });
    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify adherence to Penta-Quadrillion Empire Constitutional Invariants.
 */
export async function verifyPentaquadrillionEmpireInvariantAction(
  invariantsOrCode: PentaquadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): Promise<PentaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyPentaquadrillionEmpireConstitutionalInvariants(
      invariantsOrCode,
      proposedTargetArticleCode
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
