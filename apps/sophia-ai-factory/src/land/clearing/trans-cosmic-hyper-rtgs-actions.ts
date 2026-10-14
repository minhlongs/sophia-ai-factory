'use server';

/**
 * @file trans-cosmic-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Trans-Cosmic Hyper-RTGS clearing, Hyper netting, and Basel XIII audits.
 */

import {
  executeHyperNetting,
  validateTransCosmicHyperRtgsPayment,
  type TransCosmicHyperRtgsPaymentInput,
} from '@/tree/clearing/trans-cosmic-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXiiiSolvency,
  type BaselXiiiSolvencyInput,
} from '@/tree/reserve/basel-xiii-solvency-engine';
import type {
  HyperNettingObligation,
  TransCosmicCurrency,
} from '@/seed/types/trans-cosmic-hyper-rtgs-capital';
import {
  persistTransCosmicSession,
  persistHyperNettingBatch,
  persistBaselXiiiSolvencySnapshot,
  type TransCosmicHyperRtgsActionResult,
  type HyperNettingActionResult,
  type BaselXiiiActionResult,
} from './trans-cosmic-hyper-rtgs-persistence';

export type {
  TransCosmicHyperRtgsActionResult,
  HyperNettingActionResult,
  BaselXiiiActionResult,
};

/**
 * Server Action to validate and persist Trans-Cosmic Hyper-RTGS clearing transaction.
 */
export async function processTransCosmicPaymentAction(
  params: TransCosmicHyperRtgsPaymentInput,
): Promise<TransCosmicHyperRtgsActionResult> {
  try {
    const data = validateTransCosmicHyperRtgsPayment(params);
    await persistTransCosmicSession(params, data);
    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Trans-Cosmic payment',
    };
  }
}

/**
 * Server Action to execute Multiverse Zero-Entropy Netting 9.0 across 65,536 shards and persist batch.
 */
export async function executeHyperNettingAction(
  obligations: HyperNettingObligation[],
  settlementCurrency: TransCosmicCurrency = 'USDT',
  shardCount: number = 65536,
): Promise<HyperNettingActionResult> {
  try {
    const data = executeHyperNetting(obligations, settlementCurrency, shardCount);
    await persistHyperNettingBatch(data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute hyper netting',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XIII Trans-Cosmic capital adequacy snapshot.
 */
export async function auditBaselXiiiSolvencyAction(
  params: BaselXiiiSolvencyInput,
): Promise<BaselXiiiActionResult> {
  try {
    const data = evaluateBaselXiiiSolvency(params);
    await persistBaselXiiiSolvencySnapshot(params, data);
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to audit Basel XIII solvency',
    };
  }
}
