'use server';

/**
 * @file photonic-tachyon-actions.ts
 * @layer land/compute
 * @description Land layer Server Actions for Photonic-Tachyon batch dispatching, Dyson Swarm power, and Twelve-Nines SLA audits.
 */

import {
  planTachyonBatchDispatch,
  type TachyonDispatchPlan,
} from '@/tree/compute/photonic-tachyon-scheduler-engine';
import {
  evaluateTwelveNinesSla,
  validateDysonPower,
  type DysonPowerInput,
  type DysonPowerValidationOutput,
  type TwelveNinesSlaEvaluationOutput,
  type TwelveNinesSlaInput,
} from '@/tree/energy/dyson-swarm-energy-engine';
import type {
  DysonGenerationSource,
  PhotonicTachyonComputeMatrix,
} from '@/seed/types/photonic-tachyon-nexus';
import {
  persistDysonPowerAllocation,
  persistTachyonDispatch,
  persistTwelveNinesSlaAudit,
} from './photonic-tachyon-persistence';

export interface TachyonDispatchActionResult {
  success: boolean;
  data?: TachyonDispatchPlan;
  error?: string;
}

export interface DysonPowerActionResult {
  success: boolean;
  data?: DysonPowerValidationOutput;
  error?: string;
}

export interface TwelveNinesSlaActionResult {
  success: boolean;
  data?: TwelveNinesSlaEvaluationOutput;
  error?: string;
}

/**
 * Server Action to plan and execute 4,000,000 workload dispatch to Photonic-Tachyon matrix.
 */
export async function dispatchTachyonBatchAction(
  matrices: PhotonicTachyonComputeMatrix[],
  workloads: number = 4_000_000,
  measuredDriftFs: number = 140.0
): Promise<TachyonDispatchActionResult> {
  try {
    const data = planTachyonBatchDispatch(matrices, workloads, measuredDriftFs);
    await persistTachyonDispatch(data);
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Tachyon batch dispatch error',
    };
  }
}

/**
 * Server Action to validate Dyson Swarm net-zero power allocation.
 */
export async function validateDysonPowerAction(
  params: DysonPowerInput,
  generationSource: DysonGenerationSource = 'DYSON_SWARM_COLLECTOR'
): Promise<DysonPowerActionResult> {
  try {
    const data = validateDysonPower(params);
    await persistDysonPowerAllocation(params, generationSource, data);
    return { success: data.isCompliant, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Dyson power validation error',
    };
  }
}

/**
 * Server Action to audit Twelve-Nines SLA uptime and record certificate.
 */
export async function auditTwelveNinesSlaAction(
  params: TwelveNinesSlaInput
): Promise<TwelveNinesSlaActionResult> {
  try {
    const data = evaluateTwelveNinesSla(params);
    await persistTwelveNinesSlaAudit(params, data);
    return { success: data.slaVerdict === 'TWELVE_NINES_CERTIFIED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Twelve-Nines SLA audit error',
    };
  }
}
