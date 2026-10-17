'use server';

/**
 * @file omniverse-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Omniverse-RTGS clearing, hyper-dimensional netting, and Basel IX audits.
 */

import {
  recordCosmicNettingBatch,
  recordCosmicRtgsSession,
  recordCosmicSolvencySnapshot,
} from '@/land/clearing/cosmic-rtgs-d1-recorder';
import {
  executeHyperDimensionalNetting,
  validateOmniverseRtgsPayment,
  type HyperDimensionalNettingResult,
  type OmniverseRtgsValidationInput,
  type OmniverseRtgsValidationOutput,
} from '@/tree/clearing/omniverse-rtgs-clearing-engine';
import {
  evaluateBaselIxSolvency,
  type BaselIxSolvencyInput,
  type BaselIxSolvencyOutput,
} from '@/tree/reserve/basel-ix-solvency-engine';
import type {
  HyperDimensionalNettingObligation,
  OmniverseRtgsCurrency,
} from '@/seed/types/omniverse-rtgs-capital';

export interface OmniverseRtgsActionResult {
  success: boolean;
  data?: OmniverseRtgsValidationOutput;
  error?: string;
}

export interface HyperDimensionalNettingActionResult {
  success: boolean;
  data?: HyperDimensionalNettingResult;
  error?: string;
}

export interface BaselIxActionResult {
  success: boolean;
  data?: BaselIxSolvencyOutput;
  error?: string;
}

export async function processOmniverseRtgsPaymentAction(
  params: OmniverseRtgsValidationInput
): Promise<OmniverseRtgsActionResult> {
  try {
    const data = validateOmniverseRtgsPayment(params);
    await recordCosmicRtgsSession({
      tablePrefix: 'omniverse',
      sessionRefPrefix: 'OMNIRTGS',
      sourceParticipantId: params.sourceParticipantId,
      targetParticipantId: params.targetParticipantId,
      assetCurrency: params.assetCurrency,
      grossAmountCents: params.grossAmountCents,
      priorityTier: params.priorityTier ?? 'PLANCK_EXPEDITE',
      status: data.status,
      executionLatencyNanos: data.executionLatencyNanos,
      receiptHash: data.receiptHash,
    });
    return { success: data.valid, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Omniverse-RTGS payment failed';
    return { success: false, error: message };
  }
}

export async function executeHyperDimensionalNettingBatchAction(
  obligations: HyperDimensionalNettingObligation[],
  currency: OmniverseRtgsCurrency = 'USDT',
  shardCount: number = 1024
): Promise<HyperDimensionalNettingActionResult> {
  try {
    const data = executeHyperDimensionalNetting(obligations, currency, shardCount);
    await recordCosmicNettingBatch({
      tableName: 'hyper_dimensional_netting_batches',
      batchRefPrefix: 'HYPERDIM-NET',
      shardCountColumn: 'multidimensional_shard_count',
      solutionHashColumn: 'hyper_dimensional_solution_hash',
      shardCount: data.multidimensionalShardCount,
      grossFlowCount: data.grossFlowCount,
      grossVolumeCents: data.grossVolumeCents,
      netSettlementVolumeCents: data.netSettlementVolumeCents,
      compressionRatioPct: data.compressionRatioPct,
      status: data.status,
      solutionHash: data.hyperDimensionalSolutionHash,
    });
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Hyper-dimensional netting failed';
    return { success: false, error: message };
  }
}

export async function auditBaselIxSolvencyAction(
  params: BaselIxSolvencyInput
): Promise<BaselIxActionResult> {
  try {
    const data = evaluateBaselIxSolvency(params);
    await recordCosmicSolvencySnapshot({
      tableName: 'basel_ix_solvency_snapshots',
      snapshotRefPrefix: 'BASEL9',
      bufferColumn: 'multidimensional_capital_buffer_cents',
      compliantColumn: 'is_basel_ix_compliant',
      ...params,
      ...data,
    });
    return { success: data.isSolvent, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Basel IX audit failed';
    return { success: false, error: message };
  }
}
