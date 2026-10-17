'use server';

/**
 * @file sovereign-milliaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Millia-Quadrillion Conclave arbitration, constitutional invariant checks, and 68,719,476,736-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
  recordQuadrillionConstitutionalInvariant,
} from '@/land/governance/sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignMilliaquadrillionConclaveDispute,
  verifyMilliaquadrillionEmpireConstitutionalInvariant,
  type MilliaquadrillionDisputeInput,
  type MilliaquadrillionDisputeRuling,
  type MilliaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-milliaquadrillion-conclave-engine';
import {
  compactStateWithMilliaquadrillionBraidedStark,
  type MilliaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/milliaquadrillion-braided-stark-engine';
import type {
  MilliaquadrillionEmpireConstitutionalInvariant,
  MilliaquadrillionEmpireTransaction,
} from '@/seed/types/milliaquadrillion-braided-stark-conclave';

export interface SovereignMilliaquadrillionDisputeActionResult {
  success: boolean;
  data?: MilliaquadrillionDisputeRuling;
  error?: string;
}

export interface MilliaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: MilliaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface MilliaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: MilliaquadrillionInvariantCheckOutput;
  error?: string;
}

export async function arbitrateSovereignMilliaquadrillionDisputeAction(
  input: MilliaquadrillionDisputeInput
): Promise<SovereignMilliaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignMilliaquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'milliaquadrillion',
      ...input,
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function compactStateWithMilliaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: MilliaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<MilliaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithMilliaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'milliaquadrillion',
      batchRefPrefix: 'MILLIA-STARK',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyMilliaquadrillionConstitutionalInvariantAction(
  invariant: MilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<MilliaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyMilliaquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    await recordQuadrillionConstitutionalInvariant({
      tablePrefix: 'milliaquadrillion',
      articleCode: invariant.articleCode,
      articleTitle: invariant.articleTitle,
      isStrictlyImmutable: invariant.isStrictlyImmutable,
      verificationHash: data.verificationHash,
    });
    return { success: data.allowed, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
