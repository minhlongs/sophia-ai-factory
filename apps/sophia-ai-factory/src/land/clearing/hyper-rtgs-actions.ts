'use server';

/**
 * @file hyper-rtgs-actions.ts
 * @layer land/clearing
 * @description Land layer Server Actions for Hyper-RTGS warp clearing, distributed netting, and Basel VII audits.
 */

import { getD1 } from '@/seed/db/client';
import {
  executeDistributedMultilateralNetting,
  validateHyperRtgsPayment,
  type HyperRtgsValidationInput,
} from '@/tree/clearing/hyper-rtgs-clearing-engine';
import {
  evaluateBaselViiSolvency,
  type BaselViiSolvencyInput,
} from '@/tree/reserve/basel-vii-solvency-engine';
import type {
  DistributedNettingObligation,
  HyperRtgsCurrency,
} from '@/seed/types/hyper-rtgs-capital';
import {
  insertHyperRtgsSessionRecord,
  insertDistributedNettingBatchRecord,
  insertBaselViiSnapshotRecord,
  type HyperRtgsActionResult,
  type DistributedNettingActionResult,
  type BaselViiActionResult,
} from './hyper-rtgs-persistence';

export type {
  HyperRtgsActionResult,
  DistributedNettingActionResult,
  BaselViiActionResult,
} from './hyper-rtgs-persistence';

/**
 * Server Action to validate and persist Hyper-RTGS clearing transaction.
 */
export async function processHyperRtgsPaymentAction(
  params: HyperRtgsValidationInput,
): Promise<HyperRtgsActionResult> {
  try {
    const data = validateHyperRtgsPayment(params);
    const db = await getD1();
    if (db) {
      await insertHyperRtgsSessionRecord(db, params, data);
    }
    return { success: data.valid, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Hyper-RTGS clearing failure',
    };
  }
}

/**
 * Server Action to execute distributed multilateral netting cycle.
 */
export async function executeDistributedNettingAction(
  obligations: DistributedNettingObligation[],
  defaultCurrency: HyperRtgsCurrency = 'USDT',
  partitionCount: number = 64,
): Promise<DistributedNettingActionResult> {
  try {
    const data = executeDistributedMultilateralNetting(obligations, defaultCurrency, partitionCount);
    const db = await getD1();
    if (db) {
      await insertDistributedNettingBatchRecord(db, data);
    }
    return { success: data.status === 'NET_EXECUTED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown distributed netting failure',
    };
  }
}

/**
 * Server Action to audit global capital adequacy against Basel VII standards.
 */
export async function auditBaselViiSolvencyAction(
  params: BaselViiSolvencyInput,
  snapshotRef: string = `BASEL_VII_${Date.now()}`,
): Promise<BaselViiActionResult> {
  try {
    const data = evaluateBaselViiSolvency(params);
    const db = await getD1();
    if (db) {
      await insertBaselViiSnapshotRecord(db, params, data, snapshotRef);
    }
    return { success: data.isSolvent, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Basel VII audit failure',
    };
  }
}
