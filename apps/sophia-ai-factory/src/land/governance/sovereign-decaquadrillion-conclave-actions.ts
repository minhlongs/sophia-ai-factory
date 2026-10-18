'use server';

/**
 * @file sovereign-decaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Deca-Quadrillion Conclave arbitration, constitutional invariant checks, and 134,217,728-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
} from './sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignDecaquadrillionConclaveDispute,
  verifyDecaquadrillionEmpireConstitutionalInvariants,
  type DecaquadrillionDisputeInput,
  type DecaquadrillionDisputeRuling,
  type DecaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-decaquadrillion-conclave-engine';
import {
  compactStateWithDecaquadrillionBraidedStark,
  type DecaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/decaquadrillion-braided-stark-engine';
import type {
  DecaquadrillionEmpireConstitutionalInvariant,
  DecaquadrillionEmpireTransaction,
} from '@/seed/types/decaquadrillion-braided-stark-conclave';

export interface SovereignDecaquadrillionDisputeActionResult {
  success: boolean;
  data?: DecaquadrillionDisputeRuling;
  error?: string;
}

export interface DecaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: DecaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface DecaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: DecaquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Deca-Quadrillion dispute via Sovereign Conclave (99.999999999999% consensus).
 */
export async function arbitrateSovereignDecaquadrillionDisputeAction(
  input: DecaquadrillionDisputeInput
): Promise<SovereignDecaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignDecaquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'decaquadrillion',
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
 * Server Action to compact 4,000,000,000,000 transactions into a 64-byte root via 134,217,728-bit STARK.
 */
export async function compactStateWithDecaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: DecaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<DecaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithDecaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'decaquadrillion',
      batchRefPrefix: 'DECA-STARK',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify actions against Deca-Quadrillion Constitutional Invariants.
 */
export async function verifyDecaquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: DecaquadrillionEmpireConstitutionalInvariant[]
): Promise<DecaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyDecaquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
