'use server';

/**
 * @file sovereign-quadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Quadrillion Conclave arbitration, constitutional invariant checks, and 16,777,216-bit STARK state compaction.
 */

import {
  recordTier2ConclaveDispute,
  recordTier2StarkBatch,
} from './sovereign-tier2-conclave-d1-recorder';
import {
  arbitrateSovereignQuadrillionConclaveDispute,
  verifyQuadrillionEmpireConstitutionalInvariants,
  type QuadrillionDisputeInput,
  type QuadrillionDisputeRuling,
  type QuadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-quadrillion-conclave-engine';
import {
  compactStateWithQuadrillionHolographicStark,
  type QuadrillionHolographicStarkCompactionResult,
} from '@/tree/crypto/quadrillion-holographic-stark-engine';
import type {
  QuadrillionEmpireConstitutionalInvariant,
  QuadrillionEmpireTransaction,
} from '@/seed/types/quadrillion-holographic-stark-conclave';

export interface SovereignQuadrillionDisputeActionResult {
  success: boolean;
  data?: QuadrillionDisputeRuling;
  error?: string;
}

export interface QuadrillionHolographicCompactionActionResult {
  success: boolean;
  data?: QuadrillionHolographicStarkCompactionResult;
  error?: string;
}

export interface QuadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: QuadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Quadrillion dispute via Sovereign Conclave (99.999999999% consensus).
 */
export async function arbitrateSovereignQuadrillionDisputeAction(
  input: QuadrillionDisputeInput
): Promise<SovereignQuadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignQuadrillionConclaveDispute(input);
    await recordTier2ConclaveDispute({
      tableName: 'quadrillion_trans_cosmic_conclave_disputes',
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
 * Server Action to compact 400,000,000,000 transactions into a 64-byte root via 16,777,216-bit STARK.
 */
export async function compactStateWithQuadrillionStarkAction(
  previousStateRoot: string,
  transactions: QuadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<QuadrillionHolographicCompactionActionResult> {
  try {
    const data = compactStateWithQuadrillionHolographicStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordTier2StarkBatch({
      tableName: 'quadrillion_holographic_stark_batches',
      batchRefPrefix: 'QUAD-STARK-BATCH',
      ...data,
    });
    return { success: data.isMathematicallySound, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify adherence to Quadrillion Empire Constitutional Invariants.
 */
export async function verifyQuadrillionEmpireInvariantAction(
  invariantsOrCode: QuadrillionEmpireConstitutionalInvariant[] | string,
  proposedTargetArticleCode?: string
): Promise<QuadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyQuadrillionEmpireConstitutionalInvariants(
      invariantsOrCode,
      proposedTargetArticleCode
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
