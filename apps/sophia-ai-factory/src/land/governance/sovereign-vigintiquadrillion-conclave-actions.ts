'use server';

/**
 * @file sovereign-vigintiquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Viginti-Quadrillion Conclave arbitration, constitutional invariant checks, and 268,435,456-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
} from './sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignVigintiquadrillionConclaveDispute,
  verifyVigintiquadrillionEmpireConstitutionalInvariants,
  type VigintiquadrillionDisputeInput,
  type VigintiquadrillionDisputeRuling,
  type VigintiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-vigintiquadrillion-conclave-engine';
import {
  compactStateWithVigintiquadrillionBraidedStark,
  type VigintiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/vigintiquadrillion-braided-stark-engine';
import type {
  VigintiquadrillionEmpireConstitutionalInvariant,
  VigintiquadrillionEmpireTransaction,
} from '@/seed/types/vigintiquadrillion-braided-stark-conclave';

export interface SovereignVigintiquadrillionDisputeActionResult {
  success: boolean;
  data?: VigintiquadrillionDisputeRuling;
  error?: string;
}

export interface VigintiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: VigintiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface VigintiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: VigintiquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Viginti-Quadrillion dispute via Sovereign Conclave (99.9999999999999% consensus).
 */
export async function arbitrateSovereignVigintiquadrillionDisputeAction(
  input: VigintiquadrillionDisputeInput
): Promise<SovereignVigintiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignVigintiquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'vigintiquadrillion',
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
 * Server Action to compact 8,000,000,000,000 transactions into a 64-byte root via 268,435,456-bit STARK.
 */
export async function compactStateWithVigintiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: VigintiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<VigintiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithVigintiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'vigintiquadrillion',
      batchRefPrefix: 'VIGINTI-STARK',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify actions against Viginti-Quadrillion Constitutional Invariants.
 */
export async function verifyVigintiquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: VigintiquadrillionEmpireConstitutionalInvariant[]
): Promise<VigintiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyVigintiquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
