'use server';

/**
 * @file sovereign-ducentiquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Ducenti-Quadrillion Conclave arbitration, constitutional invariant checks, and 2,147,483,648-bit STARK state compaction.
 */

import { recordQuadrillionConclaveDispute } from './sovereign-quadrillion-conclave-d1-recorder';
import { recordTier2StarkBatch } from './sovereign-tier2-conclave-d1-recorder';
import {
  arbitrateSovereignDucentiquadrillionConclaveDispute,
  verifyDucentiquadrillionEmpireConstitutionalInvariants,
  type DucentiquadrillionDisputeInput,
  type DucentiquadrillionDisputeRuling,
  type DucentiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-ducentiquadrillion-conclave-engine';
import {
  compactStateWithDucentiquadrillionBraidedStark,
  type DucentiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/ducentiquadrillion-braided-stark-engine';
import type {
  DucentiquadrillionEmpireConstitutionalInvariant,
  DucentiquadrillionEmpireTransaction,
} from '@/seed/types/ducentiquadrillion-braided-stark-conclave';

export interface SovereignDucentiquadrillionDisputeActionResult {
  success: boolean;
  data?: DucentiquadrillionDisputeRuling;
  error?: string;
}

export interface DucentiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: DucentiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface DucentiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: DucentiquadrillionInvariantCheckOutput;
  error?: string;
}

/**
 * Server Action to arbitrate a Ducenti-Quadrillion dispute via Sovereign Conclave (99.9999999999999999% consensus).
 */
export async function arbitrateSovereignDucentiquadrillionDisputeAction(
  input: DucentiquadrillionDisputeInput
): Promise<SovereignDucentiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignDucentiquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'ducentiquadrillion',
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
 * Server Action to compact 100,000,000,000,000 transactions into a 64-byte root via 2,147,483,648-bit STARK.
 */
export async function compactStateWithDucentiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: DucentiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<DucentiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithDucentiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordTier2StarkBatch({
      tableName: 'ducentiquadrillion_braided_stark_batches',
      batchRefPrefix: 'DUCENTI-STARK',
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
 * Server Action to verify actions against Ducenti-Quadrillion Constitutional Invariants.
 */
export async function verifyDucentiquadrillionEmpireInvariantAction(
  articleCode: string,
  proposedAction: string,
  customInvariants?: DucentiquadrillionEmpireConstitutionalInvariant[]
): Promise<DucentiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyDucentiquadrillionEmpireConstitutionalInvariants(
      customInvariants ?? articleCode,
      customInvariants ? articleCode : undefined
    );
    return { success: data.allowed, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}
