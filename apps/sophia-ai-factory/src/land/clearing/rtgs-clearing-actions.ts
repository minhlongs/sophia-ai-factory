'use server';

/**
 * @file rtgs-clearing-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for RTGS payment processing, multilateral netting, and Basel V solvency audits.
 */

import {
  persistBaselVSolvencySnapshot,
  persistMultilateralNettingBatch,
  persistRtgsPaymentSession,
} from '@/land/clearing/rtgs-clearing-d1-helpers';
import {
  executeMultilateralNetting,
  validateRtgsPayment,
  type MultilateralNettingResult,
  type RtgsValidationInput,
  type RtgsValidationOutput,
} from '@/tree/clearing/rtgs-clearing-engine';
import {
  evaluateBaselVSolvency,
  type BaselVSolvencyInput,
  type BaselVSolvencyOutput,
} from '@/tree/reserve/basel-v-solvency-engine';
import type { NettingObligation, OmniversalCurrency } from '@/seed/types/omniversal-clearing';

export interface RtgsActionResult {
  success: boolean;
  data?: RtgsValidationOutput;
  error?: string;
}

export interface NettingActionResult {
  success: boolean;
  data?: MultilateralNettingResult;
  error?: string;
}

export interface BaselVActionResult {
  success: boolean;
  data?: BaselVSolvencyOutput;
  error?: string;
}

/**
 * Server Action to validate and persist RTGS clearing transaction.
 */
export async function processRtgsPaymentAction(
  params: RtgsValidationInput
): Promise<RtgsActionResult> {
  try {
    const data = validateRtgsPayment(params);
    await persistRtgsPaymentSession(params, data);
    return { success: data.valid, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown RTGS clearing failure',
    };
  }
}

/**
 * Server Action to execute multilateral netting cycle across participant obligations.
 */
export async function executeNettingCycleAction(
  obligations: NettingObligation[],
  defaultCurrency: OmniversalCurrency = 'SSDR'
): Promise<NettingActionResult> {
  try {
    const data = executeMultilateralNetting(obligations, defaultCurrency);
    await persistMultilateralNettingBatch(data);
    return { success: data.status === 'NET_EXECUTED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown netting cycle failure',
    };
  }
}

/**
 * Server Action to audit global capital adequacy against Basel V requirements.
 */
export async function auditBaselVSolvencyAction(
  params: BaselVSolvencyInput,
  auditCycle: string = `AUDIT_${Date.now()}`
): Promise<BaselVActionResult> {
  try {
    const data = evaluateBaselVSolvency(params);
    await persistBaselVSolvencySnapshot(params, data, auditCycle);
    return { success: data.isSolvent, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Basel V audit failure',
    };
  }
}
