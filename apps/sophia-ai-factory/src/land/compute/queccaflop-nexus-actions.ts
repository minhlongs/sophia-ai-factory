'use server';

/**
 * @file queccaflop-nexus-actions.ts
 * @layer land/compute
 * @description Land layer Server Actions for QueccaFLOP job dispatch, Kardashev power validation, and Eleven-Nines SLA audits.
 */

import {
  planQueccaBatchDispatch,
  type QueccaDispatchPlan,
} from '@/tree/compute/queccaflop-scheduler-engine';
import {
  evaluateElevenNinesSla,
  validateKardashevPower,
  type ElevenNinesSlaEvaluationOutput,
  type ElevenNinesSlaInput,
  type KardashevPowerInput,
  type KardashevPowerValidationOutput,
} from '@/tree/energy/kardashev-energy-engine';
import type { QueccaflopComputeGrid } from '@/seed/types/queccaflop-nexus';
import {
  recordOpticalGridDispatchD1,
  recordOpticalGridPowerD1,
  recordOpticalGridSlaD1,
} from './optical-grid-d1-recorder';

export interface QueccaDispatchActionResult {
  success: boolean;
  data?: QueccaDispatchPlan;
  error?: string;
}

export interface KardashevPowerActionResult {
  success: boolean;
  data?: KardashevPowerValidationOutput;
  error?: string;
}

export interface ElevenNinesSlaActionResult {
  success: boolean;
  data?: ElevenNinesSlaEvaluationOutput;
  error?: string;
}

export async function dispatchQueccaBatchAction(
  grids: QueccaflopComputeGrid[],
  workloads: number = 2_000_000,
  measuredDriftFs: number = 120.0,
  batchRef: string = `QBATCH_${Date.now()}`
): Promise<QueccaDispatchActionResult> {
  try {
    const data = planQueccaBatchDispatch(grids, workloads, measuredDriftFs);
    await recordOpticalGridDispatchD1({
      table: 'quecca_pipeline_dispatches',
      driftCol: 'femtosecond_clock_drift_fs',
      idPrefix: 'qdisp',
      batchRef,
      targetGridId: data.targetGridId,
      assignedWorkloads: data.assignedWorkloads,
      totalOpticalPetabytes: data.totalOpticalPetabytes,
      driftValue: data.femtosecondDriftFs,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown QueccaFLOP dispatch failure',
    };
  }
}

export async function validateKardashevPowerAction(
  params: KardashevPowerInput,
  allocationRef: string = `KPWR_${Date.now()}`
): Promise<KardashevPowerActionResult> {
  try {
    const data = validateKardashevPower(params);
    await recordOpticalGridPowerD1({
      table: 'kardashev_power_allocations',
      idPrefix: 'kpwr',
      allocationRef,
      generationSource: 'KARDASHEV_STELLAR_HARVESTER',
      allocatedMegawatts: params.allocatedMegawatts,
      carbonIntensityGCo2PerKwh: params.carbonIntensityGCo2PerKwh,
      cryoCoolingPowerMw: params.cryoCoolingPowerMw,
      coolingEfficiencyCop: params.coolingEfficiencyCop,
      isCompliant: data.isCompliant,
    });
    return { success: data.isCompliant, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown power validation failure',
    };
  }
}

export async function auditElevenNinesSlaAction(
  params: ElevenNinesSlaInput,
  auditWindow: string = `WINDOW_11N_${Date.now()}`
): Promise<ElevenNinesSlaActionResult> {
  try {
    const data = evaluateElevenNinesSla(params);
    await recordOpticalGridSlaD1({
      table: 'eleven_nines_sla_audits',
      syncCol: 'quantum_entangled_redundancy_active',
      idPrefix: 'sla11',
      auditWindow,
      totalWindowMicroseconds: params.totalWindowMicroseconds ?? 2592000000000,
      actualDowntimeMicroseconds: data.actualDowntimeMicroseconds,
      effectiveAvailabilityPct: data.effectiveAvailabilityPct,
      syncActive: Boolean(params.quantumEntangledRedundancyActive),
      bftQuorumConsensusPct: params.bftQuorumConsensusPct,
      slaVerdict: data.slaVerdict,
      auditSignature: data.auditSignature,
    });
    return { success: data.slaVerdict === 'ELEVEN_NINES_CERTIFIED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Eleven-Nines SLA audit failure',
    };
  }
}
