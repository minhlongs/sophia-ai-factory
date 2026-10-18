'use server';

/**
 * @file sovereign-centumquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Centum-Quadrillion Conclave arbitration, constitutional invariant checks, and 1,073,741,824-bit STARK state compaction.
 */

import { recordQuadrillionConclaveDispute } from './sovereign-quadrillion-conclave-d1-recorder';
import { recordTier2StarkBatch } from './sovereign-tier2-conclave-d1-recorder';
import {
  arbitrateSovereignCentumquadrillionConclaveDispute,
  verifyCentumquadrillionEmpireConstitutionalInvariants,
  type CentumquadrillionDisputeInput,
  type CentumquadrillionDisputeRuling,
  type CentumquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-centumquadrillion-conclave-engine';
import {
  compactStateWithCentumquadrillionBraidedStark,
  type CentumquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/centumquadrillion-braided-stark-engine';
import type {
  CentumquadrillionEmpireConstitutionalInvariant,
  CentumquadrillionEmpireTransaction,
} from '@/seed/types/centumquadrillion-braided-stark-conclave';

export interface SovereignCentumquadrillionDisputeActionResult {
  success: boolean;
  data?: CentumquadrillionDisputeRuling;
  error?: string;
}

export interface CentumquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: CentumquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface CentumquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: CentumquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Centum-Quadrillion dispute via Sovereign Conclave (99.999999999999999% consensus).
 */
export async function arbitrateSovereignCentumquadrillionDisputeAction(
  input: CentumquadrillionDisputeInput
): Promise<SovereignCentumquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignCentumquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'centumquadrillion',
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
 * Server Action to compact 40,000,000,000,000 transactions into a 64-byte root via 1,073,741,824-bit STARK.
 */
export async function compactStateWithCentumquadrillionStarkAction(
  previousStateRoot: string,
  transactions: CentumquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<CentumquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithCentumquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordTier2StarkBatch({
      tableName: 'centumquadrillion_braided_stark_batches',
      batchRefPrefix: 'CENTUM-STARK',
      newStateRootColumn: 'newState_root',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/**
 * Server Action to verify actions against Centum-Quadrillion Constitutional Invariants.
 */
export async function verifyCentumquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: CentumquadrillionEmpireConstitutionalInvariant[]
): Promise<CentumquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyCentumquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
