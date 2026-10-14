'use server';

/**
 * @file trans-omniverse-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Trans-Omniverse RTGS clearing, Trans-Cosmic netting, and Basel X audits.
 */

import {
  executeTransCosmicNetting,
  validateTransOmniverseRtgsPayment,
  type TransOmniverseRtgsPaymentInput,
} from '@/tree/clearing/trans-omniverse-rtgs-clearing-engine';
import {
  evaluateBaselXSolvency,
  type BaselXSolvencyInput,
} from '@/tree/reserve/basel-x-solvency-engine';
import type {
  TransCosmicNettingObligation,
  TransOmniverseCurrency,
} from '@/seed/types/trans-omniverse-rtgs-capital';
import {
  persistTransOmniverseSession,
  persistTransCosmicNettingBatch,
  persistBaselXSolvencySnapshot,
  type TransOmniverseRtgsActionResult,
  type TransCosmicNettingActionResult,
  type BaselXActionResult,
} from './trans-omniverse-rtgs-persistence';

export type {
  TransOmniverseRtgsActionResult,
  TransCosmicNettingActionResult,
  BaselXActionResult,
};

/**
 * Server Action to validate and persist Trans-Omniverse RTGS clearing transaction.
 */
export async function processTransOmniversePaymentAction(
  params: TransOmniverseRtgsPaymentInput,
): Promise<TransOmniverseRtgsActionResult> {
  try {
    const data = validateTransOmniverseRtgsPayment(params);
    await persistTransOmniverseSession(params, data);
    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Trans-Omniverse RTGS payment',
    };
  }
}

/**
 * Server Action to execute and persist Trans-Cosmic Multilateral Netting batch.
 */
export async function executeTransCosmicNettingAction(
  obligations: TransCosmicNettingObligation[],
  currency: TransOmniverseCurrency = 'USDT',
  shardCount: number = 4096,
): Promise<TransCosmicNettingActionResult> {
  try {
    const data = executeTransCosmicNetting(obligations, currency, shardCount);
    await persistTransCosmicNettingBatch(data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute Trans-Cosmic netting batch',
    };
  }
}

/**
 * Server Action to evaluate and record Basel X Solvency compliance snapshot.
 */
export async function evaluateBaselXSolvencyAction(
  input: BaselXSolvencyInput,
): Promise<BaselXActionResult> {
  try {
    const data = evaluateBaselXSolvency(input);
    await persistBaselXSolvencySnapshot(input, data);
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate Basel X solvency',
    };
  }
}
