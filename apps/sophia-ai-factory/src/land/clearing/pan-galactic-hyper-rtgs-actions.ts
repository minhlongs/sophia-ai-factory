'use server';

/**
 * @file pan-galactic-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Pan-Galactic Hyper-RTGS clearing, Netting 10.0, and Basel XIV audits.
 */

import {
  executePanGalacticNetting,
  validatePanGalacticHyperRtgsPayment,
  type PanGalacticHyperRtgsPaymentInput,
} from '@/tree/clearing/pan-galactic-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXivSolvency,
  type BaselXivSolvencyInput,
} from '@/tree/reserve/basel-xiv-solvency-engine';
import type {
  PanGalacticCurrency,
  PanGalacticNettingObligation,
} from '@/seed/types/pan-galactic-hyper-rtgs-capital';
import {
  persistPanGalacticSession,
  persistPanGalacticNettingBatch,
  persistBaselXivSolvencySnapshot,
  type PanGalacticHyperRtgsActionResult,
  type PanGalacticNettingActionResult,
  type BaselXivActionResult,
} from './pan-galactic-hyper-rtgs-persistence';

export type {
  PanGalacticHyperRtgsActionResult,
  PanGalacticNettingActionResult,
  BaselXivActionResult,
};

/**
 * Server Action to validate and persist Pan-Galactic Hyper-RTGS clearing transaction.
 */
export async function processPanGalacticPaymentAction(
  params: PanGalacticHyperRtgsPaymentInput,
): Promise<PanGalacticHyperRtgsActionResult> {
  try {
    const data = validatePanGalacticHyperRtgsPayment(params);
    await persistPanGalacticSession(params, data);
    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Pan-Galactic payment',
    };
  }
}

/**
 * Server Action to execute Multiverse Zero-Entropy Netting 10.0 across 131,072 shards and persist batch.
 */
export async function executePanGalacticNettingAction(
  obligations: PanGalacticNettingObligation[],
  settlementCurrency: PanGalacticCurrency = 'USDT',
  shardCount: number = 131072,
): Promise<PanGalacticNettingActionResult> {
  try {
    const data = executePanGalacticNetting(obligations, settlementCurrency, shardCount);
    await persistPanGalacticNettingBatch(data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute pan-galactic netting',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XIV Pan-Galactic capital adequacy snapshot.
 */
export async function auditBaselXivSolvencyAction(
  params: BaselXivSolvencyInput,
): Promise<BaselXivActionResult> {
  try {
    const data = evaluateBaselXivSolvency(params);
    await persistBaselXivSolvencySnapshot(params, data);
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to audit Basel XIV solvency',
    };
  }
}
