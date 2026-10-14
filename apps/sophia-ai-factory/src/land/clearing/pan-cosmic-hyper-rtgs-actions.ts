'use server';

/**
 * @file pan-cosmic-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Pan-Cosmic Hyper-RTGS clearing, Netting 12.0, and Basel XVI audits.
 */

import {
  executePanCosmicNetting,
  validatePanCosmicHyperRtgsPayment,
  type PanCosmicRtgsValidationInput,
} from '@/tree/clearing/pan-cosmic-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXviSolvency,
  type BaselXviSolvencyInput,
} from '@/tree/reserve/basel-xvi-solvency-engine';
import type {
  PanCosmicCurrency,
  PanCosmicNettingObligation,
} from '@/seed/types/pan-cosmic-hyper-rtgs-capital';
import {
  persistPanCosmicSession,
  persistPanCosmicNettingBatch,
  persistBaselXviSolvencySnapshot,
  type PanCosmicHyperRtgsActionResult,
  type PanCosmicNettingActionResult,
  type BaselXviActionResult,
} from './pan-cosmic-hyper-rtgs-persistence';

export type {
  PanCosmicHyperRtgsActionResult,
  PanCosmicNettingActionResult,
  BaselXviActionResult,
};

/**
 * Server Action to validate and persist Pan-Cosmic Hyper-RTGS clearing transaction.
 */
export async function processPanCosmicPaymentAction(
  params: PanCosmicRtgsValidationInput,
): Promise<PanCosmicHyperRtgsActionResult> {
  try {
    const data = validatePanCosmicHyperRtgsPayment(params);
    await persistPanCosmicSession(params, data);
    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Pan-Cosmic payment',
    };
  }
}

/**
 * Server Action to execute Multiverse Zero-Entropy Netting 12.0 across 524,288 shards and persist batch.
 */
export async function executePanCosmicNettingAction(
  obligations: PanCosmicNettingObligation[],
  settlementCurrency: PanCosmicCurrency = 'USDT',
  shardCount: number = 524288,
): Promise<PanCosmicNettingActionResult> {
  try {
    const data = executePanCosmicNetting(obligations, settlementCurrency, shardCount);
    await persistPanCosmicNettingBatch(data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute pan-cosmic netting',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XVI Pan-Cosmic capital adequacy snapshot.
 */
export async function auditBaselXviSolvencyAction(
  params: BaselXviSolvencyInput,
): Promise<BaselXviActionResult> {
  try {
    const data = evaluateBaselXviSolvency(params);
    await persistBaselXviSolvencySnapshot(params, data);
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to audit Basel XVI solvency',
    };
  }
}
