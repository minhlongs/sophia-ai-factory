'use server';

/**
 * @file super-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Super-RTGS payment processing, parallel netting, and Basel VI audits.
 */

import {
  executeParallelMultilateralNetting,
  validateSuperRtgsPayment,
  type SuperRtgsValidationInput,
} from '@/tree/clearing/super-rtgs-clearing-engine';
import {
  evaluateBaselViSolvency,
  type BaselViSolvencyInput,
} from '@/tree/reserve/basel-vi-solvency-engine';
import type {
  ParallelNettingObligation,
  SuperRtgsCurrency,
} from '@/seed/types/super-rtgs-capital';
import {
  persistBaselViSolvencySnapshot,
  persistParallelNettingBatch,
  persistSuperRtgsClearingSession,
  type BaselViActionResult,
  type ParallelNettingActionResult,
  type SuperRtgsActionResult,
} from './super-rtgs-persistence';

export type {
  SuperRtgsActionResult,
  ParallelNettingActionResult,
  BaselViActionResult,
} from './super-rtgs-persistence';

/**
 * Server Action to validate and persist Super-RTGS clearing transaction.
 */
export async function processSuperRtgsPaymentAction(
  params: SuperRtgsValidationInput
): Promise<SuperRtgsActionResult> {
  try {
    const data = validateSuperRtgsPayment(params);
    await persistSuperRtgsClearingSession(params, data);
    return { success: data.valid, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Super-RTGS clearing failure',
    };
  }
}

/**
 * Server Action to execute parallelized multilateral netting cycle.
 */
export async function executeParallelNettingAction(
  obligations: ParallelNettingObligation[],
  defaultCurrency: SuperRtgsCurrency = 'SSDR',
  partitionCount: number = 16
): Promise<ParallelNettingActionResult> {
  try {
    const data = executeParallelMultilateralNetting(obligations, defaultCurrency, partitionCount);
    await persistParallelNettingBatch(data);
    return { success: data.status === 'NET_EXECUTED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown parallel netting failure',
    };
  }
}

/**
 * Server Action to audit global capital adequacy against Basel VI standards.
 */
export async function auditBaselViSolvencyAction(
  params: BaselViSolvencyInput,
  auditCycle: string = `BASEL_VI_${Date.now()}`
): Promise<BaselViActionResult> {
  try {
    const data = evaluateBaselViSolvency(params);
    await persistBaselViSolvencySnapshot(params, auditCycle, data);
    return { success: data.isSolvent, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Basel VI audit failure',
    };
  }
}
