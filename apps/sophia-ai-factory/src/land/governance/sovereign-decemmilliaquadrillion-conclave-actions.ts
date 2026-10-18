'use server';

/**
 * @file sovereign-decemmilliaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Decem-Millia-Quadrillion Conclave arbitration, constitutional invariant checks, and 549,755,813,888-bit STARK state compaction.
 */

import {
  recordSovereignBraidedStarkBatch,
  recordSovereignConclaveDispute,
  recordSovereignConstitutionalInvariant,
} from '@/land/governance/conclave-d1-recorder';
import {
  arbitrateSovereignDecemmilliaquadrillionConclaveDispute,
  verifyDecemmilliaquadrillionEmpireConstitutionalInvariant,
  type DecemmilliaquadrillionDisputeInput,
  type DecemmilliaquadrillionDisputeRuling,
  type DecemmilliaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-decemmilliaquadrillion-conclave-engine';
import {
  compactStateWithDecemmilliaquadrillionBraidedStark,
  type DecemmilliaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/decemmilliaquadrillion-braided-stark-engine';
import type {
  DecemmilliaquadrillionEmpireConstitutionalInvariant,
  DecemmilliaquadrillionEmpireTransaction,
} from '@/seed/types/decemmilliaquadrillion-braided-stark-conclave';

export interface SovereignDecemmilliaquadrillionDisputeActionResult {
  success: boolean;
  data?: DecemmilliaquadrillionDisputeRuling;
  error?: string;
}

export interface DecemmilliaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: DecemmilliaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface DecemmilliaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: DecemmilliaquadrillionInvariantCheckOutput;
  error?: string;
}

export async function arbitrateSovereignDecemmilliaquadrillionDisputeAction(
  input: DecemmilliaquadrillionDisputeInput
): Promise<SovereignDecemmilliaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignDecemmilliaquadrillionConclaveDispute(input);
    await recordSovereignConclaveDispute({
      tablePrefix: 'decemmilliaquadrillion',
      ...input,
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown dispute arbitration error' };
  }
}

export async function compactDecemmilliaquadrillionBraidedStarkAction(
  previousStateRoot: string,
  transactions: DecemmilliaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<DecemmilliaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithDecemmilliaquadrillionBraidedStark(previousStateRoot, transactions, circuitIdentifier);
    await recordSovereignBraidedStarkBatch({
      tablePrefix: 'decemmilliaquadrillion',
      batchRefPrefix: 'STARK-BATCH-DECEM',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown STARK compaction error' };
  }
}

export async function verifyDecemmilliaquadrillionEmpireInvariantAction(
  invariant: DecemmilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<DecemmilliaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyDecemmilliaquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    await recordSovereignConstitutionalInvariant({
      tablePrefix: 'decemmilliaquadrillion',
      articleCode: invariant.articleCode,
      articleTitle: invariant.articleTitle,
      isStrictlyImmutable: invariant.isStrictlyImmutable,
      verificationHash: data.verificationHash,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown constitutional invariant error' };
  }
}
