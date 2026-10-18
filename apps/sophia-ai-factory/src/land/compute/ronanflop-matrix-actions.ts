'use server';

/**
 * @file ronanflop-matrix-actions.ts
 * @layer land/compute
 * @description Land layer Server Actions for RonanFLOP job dispatch, Matrioshka power validation, and Ten-Nines SLA audits.
 */

import {
  planOpticalBatchDispatch,
  type OpticalDispatchPlan,
} from '@/tree/compute/ronanflop-optical-engine';
import {
  evaluateTenNinesSla,
  validateMatrioshkaPower,
  type MatrioshkaPowerInput,
  type MatrioshkaPowerValidationOutput,
  type TenNinesSlaEvaluationOutput,
  type TenNinesSlaInput,
} from '@/tree/energy/matrioshka-power-engine';
import type { RonanflopComputeGrid } from '@/seed/types/ronanflop-matrix';
import {
  recordOpticalGridDispatchD1,
  recordOpticalGridPowerD1,
  recordOpticalGridSlaD1,
} from './optical-grid-d1-recorder';

export interface OpticalDispatchActionResult {
  success: boolean;
  data?: OpticalDispatchPlan;
  error?: string;
}

export interface MatrioshkaPowerActionResult {
  success: boolean;
  data?: MatrioshkaPowerValidationOutput;
  error?: string;
}

export interface TenNinesSlaActionResult {
  success: boolean;
  data?: TenNinesSlaEvaluationOutput;
  error?: string;
}

export async function dispatchOpticalBatchAction(
  grids: RonanflopComputeGrid[],
  workloads: number = 1_000_000,
  measuredDriftPs: number = 0.12,
  batchRef: string = `BATCH_${Date.now()}`
): Promise<OpticalDispatchActionResult> {
  try {
    const data = planOpticalBatchDispatch(grids, workloads, measuredDriftPs);
    await recordOpticalGridDispatchD1({
      table: 'optical_pipeline_dispatches',
      driftCol: 'relativistic_doppler_drift_ps',
      idPrefix: 'disp',
      batchRef,
      targetGridId: data.targetGridId,
      assignedWorkloads: data.assignedWorkloads,
      totalOpticalPetabytes: data.totalOpticalPetabytes,
      driftValue: data.relativisticDriftPs,
    });
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown optical dispatch failure',
    };
  }
}

export async function validateMatrioshkaPowerAction(
  params: MatrioshkaPowerInput,
  allocationRef: string = `PWR_${Date.now()}`
): Promise<MatrioshkaPowerActionResult> {
  try {
    const data = validateMatrioshkaPower(params);
    await recordOpticalGridPowerD1({
      table: 'matrioshka_power_allocations',
      idPrefix: 'pwr',
      allocationRef,
      generationSource: 'MATRIOSHKA_DYSON_SWARM',
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

export async function auditTenNinesSlaAction(
  params: TenNinesSlaInput,
  auditWindow: string = `WINDOW_${Date.now()}`
): Promise<TenNinesSlaActionResult> {
  try {
    const data = evaluateTenNinesSla(params);
    await recordOpticalGridSlaD1({
      table: 'ten_nines_sla_audits',
      syncCol: 'quantum_teleport_sync_active',
      idPrefix: 'sla',
      auditWindow,
      totalWindowMicroseconds: params.totalWindowMicroseconds ?? 2592000000000,
      actualDowntimeMicroseconds: data.actualDowntimeMicroseconds,
      effectiveAvailabilityPct: data.effectiveAvailabilityPct,
      syncActive: Boolean(params.quantumTeleportSyncActive),
      bftQuorumConsensusPct: params.bftQuorumConsensusPct,
      slaVerdict: data.slaVerdict,
      auditSignature: data.auditSignature,
    });
    return { success: data.slaVerdict === 'TEN_NINES_CERTIFIED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Ten-Nines SLA audit failure',
    };
  }
}
