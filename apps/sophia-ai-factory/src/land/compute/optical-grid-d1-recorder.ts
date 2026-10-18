/**
 * @file optical-grid-d1-recorder.ts
 * @layer land/compute
 * @description Shared D1 persistence helper for RonanFLOP and QueccaFLOP optical-quantum grid actions.
 */

import { getD1 } from '@/seed/db/client';

export interface RecordOpticalGridDispatchInput {
  table: string;
  driftCol: string;
  idPrefix: string;
  batchRef: string;
  targetGridId: string;
  assignedWorkloads: number;
  totalOpticalPetabytes: number;
  driftValue: number;
}

export interface RecordOpticalGridPowerInput {
  table: string;
  idPrefix: string;
  allocationRef: string;
  generationSource: string;
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number;
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
  isCompliant: boolean;
}

export interface RecordOpticalGridSlaInput {
  table: string;
  syncCol: string;
  idPrefix: string;
  auditWindow: string;
  totalWindowMicroseconds: number;
  actualDowntimeMicroseconds: number;
  effectiveAvailabilityPct: number;
  syncActive: boolean;
  bftQuorumConsensusPct: number;
  slaVerdict: string;
  auditSignature: string;
}

export async function recordOpticalGridDispatchD1(input: RecordOpticalGridDispatchInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, batch_ref, target_grid_id, concurrent_job_count,
         total_optical_petabytes, ${input.driftCol}, dispatch_state, completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `${input.idPrefix}_${Date.now()}`,
      input.batchRef,
      input.targetGridId,
      input.assignedWorkloads,
      input.totalOpticalPetabytes,
      input.driftValue,
      'RENDERED_SYNTHESIZED',
      new Date().toISOString()
    )
    .run();
}

export async function recordOpticalGridPowerD1(input: RecordOpticalGridPowerInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, allocation_ref, generation_source, allocated_megawatts,
         carbon_intensity_g_co2_per_kwh, cryo_cooling_power_mw, cooling_efficiency_cop,
         is_pure_net_zero
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `${input.idPrefix}_${Date.now()}`,
      input.allocationRef,
      input.generationSource,
      input.allocatedMegawatts,
      input.carbonIntensityGCo2PerKwh,
      input.cryoCoolingPowerMw,
      input.coolingEfficiencyCop,
      input.isCompliant ? 1 : 0
    )
    .run();
}

export async function recordOpticalGridSlaD1(input: RecordOpticalGridSlaInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, audit_window, total_window_microseconds, actual_downtime_microseconds,
         effective_availability_pct, ${input.syncCol}, bft_quorum_consensus_pct,
         sla_verdict, audit_signature
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `${input.idPrefix}_${Date.now()}`,
      input.auditWindow,
      input.totalWindowMicroseconds,
      input.actualDowntimeMicroseconds,
      input.effectiveAvailabilityPct,
      input.syncActive ? 1 : 0,
      input.bftQuorumConsensusPct,
      input.slaVerdict,
      input.auditSignature
    )
    .run();
}
