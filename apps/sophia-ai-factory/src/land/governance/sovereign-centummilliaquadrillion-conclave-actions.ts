'use server';

/**
 * @file sovereign-centummilliaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Centummillia-Quadrillion Conclave arbitration, constitutional invariant checks, and 8,589,934,592-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
  recordQuadrillionConstitutionalInvariant,
} from '@/land/governance/sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignCentummilliaquadrillionConclaveDispute,
  verifyCentummilliaquadrillionEmpireConstitutionalInvariant,
  type CentummilliaquadrillionDisputeInput,
  type CentummilliaquadrillionDisputeRuling,
  type CentummilliaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-centummilliaquadrillion-conclave-engine';
import {
  compactStateWithCentummilliaquadrillionBraidedStark,
  type CentummilliaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/centummilliaquadrillion-braided-stark-engine';
import type {
  CentummilliaquadrillionEmpireConstitutionalInvariant,
  CentummilliaquadrillionEmpireTransaction,
} from '@/seed/types/centummilliaquadrillion-braided-stark-conclave';

export interface SovereignCentummilliaquadrillionDisputeActionResult {
  success: boolean;
  data?: CentummilliaquadrillionDisputeRuling;
  error?: string;
}

export interface CentummilliaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: CentummilliaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface CentummilliaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: CentummilliaquadrillionInvariantCheckOutput;
  error?: string;
}

export async function arbitrateSovereignCentummilliaquadrillionDisputeAction(
  input: CentummilliaquadrillionDisputeInput
): Promise<SovereignCentummilliaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignCentummilliaquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'centummilliaquadrillion',
      ...input,
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function compactStateWithCentummilliaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: CentummilliaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<CentummilliaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithCentummilliaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'centummilliaquadrillion',
      batchRefPrefix: 'CENTUMMILLIA-STARK',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyCentummilliaquadrillionConstitutionalInvariantAction(
  invariant: CentummilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<CentummilliaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyCentummilliaquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    await recordQuadrillionConstitutionalInvariant({
      tablePrefix: 'centummilliaquadrillion',
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
