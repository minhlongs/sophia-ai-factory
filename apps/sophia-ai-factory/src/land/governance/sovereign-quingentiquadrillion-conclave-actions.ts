'use server';

/**
 * @file sovereign-quingentiquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Quingenti-Quadrillion Conclave arbitration, constitutional invariant checks, and 34,359,738,368-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
  recordQuadrillionConstitutionalInvariant,
} from '@/land/governance/sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignQuingentiquadrillionConclaveDispute,
  verifyQuingentiquadrillionEmpireConstitutionalInvariant,
  type QuingentiquadrillionDisputeInput,
  type QuingentiquadrillionDisputeRuling,
  type QuingentiquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-quingentiquadrillion-conclave-engine';
import {
  compactStateWithQuingentiquadrillionBraidedStark,
  type QuingentiquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/quingentiquadrillion-braided-stark-engine';
import type {
  QuingentiquadrillionEmpireConstitutionalInvariant,
  QuingentiquadrillionEmpireTransaction,
} from '@/seed/types/quingentiquadrillion-braided-stark-conclave';

export interface SovereignQuingentiquadrillionDisputeActionResult {
  success: boolean;
  data?: QuingentiquadrillionDisputeRuling;
  error?: string;
}

export interface QuingentiquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: QuingentiquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface QuingentiquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: QuingentiquadrillionInvariantCheckOutput;
  error?: string;
}

export async function arbitrateSovereignQuingentiquadrillionDisputeAction(
  input: QuingentiquadrillionDisputeInput
): Promise<SovereignQuingentiquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignQuingentiquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'quingentiquadrillion',
      ...input,
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function compactStateWithQuingentiquadrillionStarkAction(
  previousStateRoot: string,
  transactions: QuingentiquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<QuingentiquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithQuingentiquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'quingentiquadrillion',
      batchRefPrefix: 'QUINGENTI-STARK',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyQuingentiquadrillionConstitutionalInvariantAction(
  invariant: QuingentiquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<QuingentiquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyQuingentiquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    await recordQuadrillionConstitutionalInvariant({
      tablePrefix: 'quingentiquadrillion',
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
