'use server';

/**
 * @file photonic-tachyon-actions.ts
 * @layer land/compute
 * @description Land layer Server Actions for Photonic-Tachyon batch dispatching, Dyson Swarm power, and Twelve-Nines SLA audits.
 */

import { getD1 } from '@/seed/db/client';
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
    const db = await getD1();

    if (db) {
      const dispatchRef = `TACH_DISP_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO tachyon_pipeline_dispatches (
             id, dispatch_ref, target_matrix_id, assigned_workload_count,
             optical_data_petabytes, tachyon_drift_fs, dispatch_state,
             dispatch_hash, dispatched_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `tdisp_${Date.now()}`,
          dispatchRef,
          data.targetMatrixId,
          data.assignedWorkloads,
          data.totalOpticalPetabytes,
          data.tachyonDriftFs,
          'COMPLETED_SUPERCONDUCTING',
          data.dispatchHash,
          new Date().toISOString()
        )
        .run();
    }

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
    const db = await getD1();

    if (db) {
      const allocRef = `DYSON_ALLOC_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO dyson_swarm_power_allocations (
             id, allocation_ref, generation_source, allocated_megawatts,
             carbon_intensity_g_co2_per_kwh, cryo_cooling_power_mw,
             cooling_efficiency_cop, is_pure_net_zero, verified_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `dyson_alloc_${Date.now()}`,
          allocRef,
          generationSource,
          params.allocatedMegawatts,
          params.carbonIntensityGCo2PerKwh,
          params.cryoCoolingPowerMw,
          params.coolingEfficiencyCop,
          data.isCompliant ? 1 : 0,
          new Date().toISOString()
        )
        .run();
    }

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
    const db = await getD1();

    if (db) {
      const auditRef = `TWELVE_NINES_${Date.now()}`;
      await db
        .prepare(
          `INSERT INTO twelve_nines_sla_audits (
             id, audit_ref, total_window_microseconds, actual_downtime_microseconds,
             effective_availability_pct, tachyon_entanglement_active,
             bft_quorum_consensus_pct, sla_verdict, audit_signature, audited_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `sla_audit_${Date.now()}`,
          auditRef,
          params.totalWindowMicroseconds ?? 2_592_000_000_000,
          data.actualDowntimeMicroseconds,
          data.effectiveAvailabilityPct,
          params.tachyonEntanglementActive ? 1 : 0,
          params.bftQuorumConsensusPct,
          data.slaVerdict,
          data.auditSignature,
          new Date().toISOString()
        )
        .run();
    }

    return { success: data.slaVerdict === 'TWELVE_NINES_CERTIFIED', data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown Twelve-Nines SLA audit error',
    };
  }
}
