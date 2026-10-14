'use server';

/**
 * @file infinite-continuum-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Infinite-Continuum RTGS clearing, Continuum netting, and Basel XI audits.
 */

import {
  executeContinuumNetting,
  validateInfiniteContinuumRtgsPayment,
  type InfiniteContinuumRtgsPaymentInput,
} from '@/tree/clearing/infinite-continuum-rtgs-clearing-engine';
import {
  evaluateBaselXiSolvency,
  type BaselXiSolvencyInput,
} from '@/tree/reserve/basel-xi-solvency-engine';
import type {
  ContinuumCurrency,
  ContinuumNettingObligation,
} from '@/seed/types/infinite-continuum-rtgs-capital';
import {
  persistInfiniteContinuumSession,
  persistContinuumNettingBatch,
  persistBaselXiSolvencySnapshot,
  type InfiniteContinuumRtgsActionResult,
  type ContinuumNettingActionResult,
  type BaselXiActionResult,
} from './infinite-continuum-rtgs-persistence';

export type {
  InfiniteContinuumRtgsActionResult,
  ContinuumNettingActionResult,
  BaselXiActionResult,
};

/**
 * Server Action to validate and persist Infinite-Continuum RTGS clearing transaction.
 */
export async function processInfiniteContinuumPaymentAction(
  params: InfiniteContinuumRtgsPaymentInput,
): Promise<InfiniteContinuumRtgsActionResult> {
  try {
    const data = validateInfiniteContinuumRtgsPayment(params);
    await persistInfiniteContinuumSession(params, data);
    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Infinite-Continuum RTGS payment',
    };
  }
}

/**
 * Server Action to execute and persist Continuum Multilateral Netting batch.
 */
export async function executeContinuumNettingAction(
  obligations: ContinuumNettingObligation[],
  currency: ContinuumCurrency = 'USDT',
  shardCount: number = 16384,
): Promise<ContinuumNettingActionResult> {
  try {
    const data = executeContinuumNetting(obligations, currency, shardCount);
    await persistContinuumNettingBatch(data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Continuum netting batch',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XI Solvency compliance snapshot.
 */
export async function evaluateBaselXiSolvencyAction(
  input: BaselXiSolvencyInput,
): Promise<BaselXiActionResult> {
  try {
    const data = evaluateBaselXiSolvency(input);
    await persistBaselXiSolvencySnapshot(input, data);
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate Basel XI solvency',
    };
  }
}
