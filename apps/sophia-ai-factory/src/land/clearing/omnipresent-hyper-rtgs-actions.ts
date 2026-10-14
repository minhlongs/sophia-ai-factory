'use server';

/**
 * @file omnipresent-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Omnipresent Hyper-RTGS clearing, Multiverse netting, and Basel XII audits.
 */

import {
  executeMultiverseNetting,
  validateOmnipresentHyperRtgsPayment,
  type OmnipresentHyperRtgsPaymentInput,
} from '@/tree/clearing/omnipresent-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXiiSolvency,
  type BaselXiiSolvencyInput,
} from '@/tree/reserve/basel-xii-solvency-engine';
import type {
  MultiverseCurrency,
  MultiverseNettingObligation,
} from '@/seed/types/omnipresent-hyper-rtgs-capital';
import {
  persistOmnipresentSession,
  persistMultiverseNettingBatch,
  persistBaselXiiSolvencySnapshot,
  type OmnipresentHyperRtgsActionResult,
  type MultiverseNettingActionResult,
  type BaselXiiActionResult,
} from './omnipresent-hyper-rtgs-persistence';

export type {
  OmnipresentHyperRtgsActionResult,
  MultiverseNettingActionResult,
  BaselXiiActionResult,
};

/**
 * Server Action to validate and persist Omnipresent Hyper-RTGS clearing transaction.
 */
export async function processOmnipresentPaymentAction(
  params: OmnipresentHyperRtgsPaymentInput,
): Promise<OmnipresentHyperRtgsActionResult> {
  try {
    const data = validateOmnipresentHyperRtgsPayment(params);
    await persistOmnipresentSession(params, data);
    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Omnipresent Hyper-RTGS payment',
    };
  }
}

/**
 * Server Action to execute and persist Multiverse Multilateral Netting batch.
 */
export async function executeMultiverseNettingAction(
  obligations: MultiverseNettingObligation[],
  currency: MultiverseCurrency = 'USDT',
  shardCount: number = 32768,
): Promise<MultiverseNettingActionResult> {
  try {
    const data = executeMultiverseNetting(obligations, currency, shardCount);
    await persistMultiverseNettingBatch(data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Multiverse netting batch',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XII Solvency compliance snapshot.
 */
export async function evaluateBaselXiiSolvencyAction(
  input: BaselXiiSolvencyInput,
): Promise<BaselXiiActionResult> {
  try {
    const data = evaluateBaselXiiSolvency(input);
    await persistBaselXiiSolvencySnapshot(input, data);
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate Basel XII solvency',
    };
  }
}
