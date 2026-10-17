'use server';

/**
 * @file galactic-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Galactic-RTGS quantum clearing, fractal netting, and Basel VIII audits.
 */

import {
  recordCosmicNettingBatch,
  recordCosmicRtgsSession,
  recordCosmicSolvencySnapshot,
} from '@/land/clearing/cosmic-rtgs-d1-recorder';
import {
  executeFractalMultilateralNetting,
  validateGalacticRtgsPayment,
  type FractalMultilateralNettingResult,
  type GalacticRtgsValidationInput,
  type GalacticRtgsValidationOutput,
} from '@/tree/clearing/galactic-rtgs-clearing-engine';
import {
  evaluateBaselViiiSolvency,
  type BaselViiiSolvencyInput,
  type BaselViiiSolvencyOutput,
} from '@/tree/reserve/basel-viii-solvency-engine';
import type {
  FractalNettingObligation,
  GalacticRtgsCurrency,
} from '@/seed/types/galactic-rtgs-capital';

export interface GalacticRtgsActionResult {
  success: boolean;
  data?: GalacticRtgsValidationOutput;
  error?: string;
}

export interface FractalNettingActionResult {
  success: boolean;
  data?: FractalMultilateralNettingResult;
  error?: string;
}

export interface BaselViiiActionResult {
  success: boolean;
  data?: BaselViiiSolvencyOutput;
  error?: string;
}

export async function processGalacticRtgsPaymentAction(
  params: GalacticRtgsValidationInput
): Promise<GalacticRtgsActionResult> {
  try {
    const data = validateGalacticRtgsPayment(params);
    await recordCosmicRtgsSession({
      tablePrefix: 'galactic',
      sessionRefPrefix: 'GRTGS',
      sourceParticipantId: params.sourceParticipantId,
      targetParticipantId: params.targetParticipantId,
      assetCurrency: params.assetCurrency,
      grossAmountCents: params.grossAmountCents,
      priorityTier: params.priorityTier ?? 'QUANTUM_EXPEDITE',
      status: data.status,
      executionLatencyNanos: data.executionLatencyNanos,
      receiptHash: data.receiptHash,
    });
    return { success: data.valid, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Galactic-RTGS payment failed';
    return { success: false, error: message };
  }
}

export async function executeFractalNettingBatchAction(
  obligations: FractalNettingObligation[],
  currency: GalacticRtgsCurrency = 'USDT',
  shardCount: number = 256
): Promise<FractalNettingActionResult> {
  try {
    const data = executeFractalMultilateralNetting(obligations, currency, shardCount);
    await recordCosmicNettingBatch({
      tableName: 'fractal_multilateral_netting_batches',
      batchRefPrefix: 'FRACTAL-NET',
      shardCountColumn: 'hierarchical_shard_count',
      solutionHashColumn: 'fractal_solution_hash',
      shardCount: data.hierarchicalShardCount,
      grossFlowCount: data.grossFlowCount,
      grossVolumeCents: data.grossVolumeCents,
      netSettlementVolumeCents: data.netSettlementVolumeCents,
      compressionRatioPct: data.compressionRatioPct,
      status: data.status,
      solutionHash: data.fractalSolutionHash,
    });
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fractal netting failed';
    return { success: false, error: message };
  }
}

export async function auditBaselViiiSolvencyAction(
  params: BaselViiiSolvencyInput
): Promise<BaselViiiActionResult> {
  try {
    const data = evaluateBaselViiiSolvency(params);
    await recordCosmicSolvencySnapshot({
      tableName: 'basel_viii_solvency_snapshots',
      snapshotRefPrefix: 'BASEL8',
      bufferColumn: 'sovereign_planetary_capital_buffer_cents',
      compliantColumn: 'is_basel_viii_compliant',
      ...params,
      ...data,
    });
    return { success: data.isSolvent, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Basel VIII audit failed';
    return { success: false, error: message };
  }
}
