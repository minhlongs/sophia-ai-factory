'use server';

/**
 * @file sovereign-quingentimilliaquadrillion-conclave-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for Sovereign Quingenti-Millia-Quadrillion Conclave arbitration, constitutional invariant checks, and 274,877,906,944-bit STARK state compaction.
 */

import {
  recordQuadrillionBraidedStarkBatch,
  recordQuadrillionConclaveDispute,
  recordQuadrillionConstitutionalInvariant,
} from '@/land/governance/sovereign-quadrillion-conclave-d1-recorder';
import {
  arbitrateSovereignQuingentimilliaquadrillionConclaveDispute,
  verifyQuingentimilliaquadrillionEmpireConstitutionalInvariant,
  type QuingentimilliaquadrillionDisputeInput,
  type QuingentimilliaquadrillionDisputeRuling,
  type QuingentimilliaquadrillionInvariantCheckOutput,
} from '@/tree/governance/sovereign-quingentimilliaquadrillion-conclave-engine';
import {
  compactStateWithQuingentimilliaquadrillionBraidedStark,
  type QuingentimilliaquadrillionBraidedStarkCompactionResult,
} from '@/tree/crypto/quingentimilliaquadrillion-braided-stark-engine';
import type {
  QuingentimilliaquadrillionEmpireConstitutionalInvariant,
  QuingentimilliaquadrillionEmpireTransaction,
} from '@/seed/types/quingentimilliaquadrillion-braided-stark-conclave';

export interface SovereignQuingentimilliaquadrillionDisputeActionResult {
  success: boolean;
  data?: QuingentimilliaquadrillionDisputeRuling;
  error?: string;
}

export interface QuingentimilliaquadrillionBraidedCompactionActionResult {
  success: boolean;
  data?: QuingentimilliaquadrillionBraidedStarkCompactionResult;
  error?: string;
}

export interface QuingentimilliaquadrillionEmpireInvariantActionResult {
  success: boolean;
  data?: QuingentimilliaquadrillionInvariantCheckOutput;
  error?: string;
}

export async function arbitrateSovereignQuingentimilliaquadrillionDisputeAction(
  input: QuingentimilliaquadrillionDisputeInput
): Promise<SovereignQuingentimilliaquadrillionDisputeActionResult> {
  try {
    const data = arbitrateSovereignQuingentimilliaquadrillionConclaveDispute(input);
    await recordQuadrillionConclaveDispute({
      tablePrefix: 'quingentimilliaquadrillion',
      ...input,
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function compactStateWithQuingentimilliaquadrillionStarkAction(
  previousStateRoot: string,
  transactions: QuingentimilliaquadrillionEmpireTransaction[],
  circuitIdentifier?: string
): Promise<QuingentimilliaquadrillionBraidedCompactionActionResult> {
  try {
    const data = compactStateWithQuingentimilliaquadrillionBraidedStark(
      previousStateRoot,
      transactions,
      circuitIdentifier
    );
    await recordQuadrillionBraidedStarkBatch({
      tablePrefix: 'quingentimilliaquadrillion',
      batchRefPrefix: 'QUINGENTI-STARK',
      ...data,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function verifyQuingentimilliaquadrillionConstitutionalInvariantAction(
  invariant: QuingentimilliaquadrillionEmpireConstitutionalInvariant,
  proposedAction: string
): Promise<QuingentimilliaquadrillionEmpireInvariantActionResult> {
  try {
    const data = verifyQuingentimilliaquadrillionEmpireConstitutionalInvariant(invariant, proposedAction);
    await recordQuadrillionConstitutionalInvariant({
      tablePrefix: 'quingentimilliaquadrillion',
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
