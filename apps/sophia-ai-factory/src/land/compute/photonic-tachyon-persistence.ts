/**
 * @file photonic-tachyon-persistence.ts
 * @layer land/compute
 * @description D1 persistence helpers for Photonic-Tachyon dispatches, Dyson power, and Twelve-Nines SLA audits.
 */

import { getD1 } from '@/seed/db/client';
import type { TachyonDispatchPlan } from '@/tree/compute/photonic-tachyon-scheduler-engine';
import type {
  DysonPowerInput,
  DysonPowerValidationOutput,
  TwelveNinesSlaEvaluationOutput,
  TwelveNinesSlaInput,
} from '@/tree/energy/dyson-swarm-energy-engine';
import type { DysonGenerationSource } from '@/seed/types/photonic-tachyon-nexus';

export async function persistTachyonDispatch(data: TachyonDispatchPlan): Promise<void> {
  const db = await getD1();
  if (!db) return;

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

export async function persistDysonPowerAllocation(
  params: DysonPowerInput,
  generationSource: DysonGenerationSource,
  data: DysonPowerValidationOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

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

export async function persistTwelveNinesSlaAudit(
  params: TwelveNinesSlaInput,
  data: TwelveNinesSlaEvaluationOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

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
