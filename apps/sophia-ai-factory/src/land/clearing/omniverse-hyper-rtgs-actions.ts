'use server';

/**
 * @file omniverse-hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Omniverse Hyper-RTGS clearing, Netting 11.0, and Basel XV audits.
 */

import {
  executeOmniverseNetting,
  validateOmniverseHyperRtgsPayment,
  type OmniverseHyperRtgsPaymentInput,
} from '@/tree/clearing/omniverse-hyper-rtgs-clearing-engine';
import {
  evaluateBaselXvSolvency,
  type BaselXvSolvencyInput,
} from '@/tree/reserve/basel-xv-solvency-engine';
import type {
  OmniverseCurrency,
  OmniverseNettingObligation,
} from '@/seed/types/omniverse-hyper-rtgs-capital';
import {
  persistOmniverseSession,
  persistOmniverseNettingBatch,
  persistBaselXvSolvencySnapshot,
  type OmniverseHyperRtgsActionResult,
  type OmniverseNettingActionResult,
  type BaselXvActionResult,
} from './omniverse-hyper-rtgs-persistence';

export type {
  OmniverseHyperRtgsActionResult,
  OmniverseNettingActionResult,
  BaselXvActionResult,
};

/**
 * Server Action to validate and persist Omniverse Hyper-RTGS clearing transaction.
 */
export async function processOmniversePaymentAction(
  params: OmniverseHyperRtgsPaymentInput,
): Promise<OmniverseHyperRtgsActionResult> {
  try {
    const data = validateOmniverseHyperRtgsPayment(params);
    await persistOmniverseSession(params, data);
    return { success: data.valid, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Omniverse payment',
    };
  }
}

/**
 * Server Action to execute Multiverse Zero-Entropy Netting 11.0 across 262,144 shards and persist batch.
 */
export async function executeOmniverseNettingAction(
  obligations: OmniverseNettingObligation[],
  settlementCurrency: OmniverseCurrency = 'USDT',
  shardCount: number = 262144,
): Promise<OmniverseNettingActionResult> {
  try {
    const data = executeOmniverseNetting(obligations, settlementCurrency, shardCount);
    await persistOmniverseNettingBatch(data);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute omniverse netting',
    };
  }
}

/**
 * Server Action to evaluate and record Basel XV Omniverse capital adequacy snapshot.
 */
export async function auditBaselXvSolvencyAction(
  params: BaselXvSolvencyInput,
): Promise<BaselXvActionResult> {
  try {
    const data = evaluateBaselXvSolvency(params);
    await persistBaselXvSolvencySnapshot(params, data);
    return { success: data.isSolvent, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to audit Basel XV solvency',
    };
  }
}
