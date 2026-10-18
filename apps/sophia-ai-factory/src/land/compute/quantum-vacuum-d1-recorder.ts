/**
 * @file quantum-vacuum-d1-recorder.ts
 * @layer land/compute
 * @description Shared D1 persistence helper for Quantum, Vacuum, and Foam compute dispatch, power, and SLA audit actions.
 */

import { getD1 } from '@/seed/db/client';

export interface RecordStandardDispatchD1Input {
  table: string;
  targetCol: string;
  dispatchRef: string;
  sessionToken: string;
  targetRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  latencyNanos: number;
  driftFs: number;
  dispatchedAt?: string;
}

export interface RecordStandardPowerD1Input {
  table: string;
  copCol?: string;
  allocationRef: string;
  powerSourceType: string;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  copValue: number;
  isCompliant: boolean;
  allocatedAt?: string;
}

export interface RecordStandardSlaD1Input {
  table: string;
  metCol: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  actualDowntimeNanoseconds: number;
  effectiveAvailabilityPct: number;
  isMet: boolean;
  bftConsensusNodes: number;
  auditSignature: string;
  auditedAt?: string;
}

export function randomRefSuffix(): string {
  return Math.random().toString(36).substring(2, 7);
}

export async function recordStandardDispatchD1(input: RecordStandardDispatchD1Input): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, dispatch_ref, session_token, ${input.targetCol}, pipeline_job_count,
         data_volume_petabytes, dispatch_latency_nanos, drift_compensation_fs,
         dispatch_status, dispatched_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.dispatchRef,
      input.sessionToken,
      input.targetRef,
      input.assignedWorkloads,
      input.totalBandwidthPetabytes,
      input.latencyNanos,
      input.driftFs,
      'COMPLETED_SYNCHRONOUS',
      input.dispatchedAt ?? new Date().toISOString()
    )
    .run();
}

export async function recordStandardPowerD1(input: RecordStandardPowerD1Input): Promise<void> {
  const db = await getD1();
  if (!db) return;

  const copCol = input.copCol ?? 'bose_einstein_cop';
  const srcCol = input.table === 'zero_point_flux_allocations' ? 'flux_source_type' : 'power_source_type';

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, allocation_ref, ${srcCol}, megawatts_allocated,
         carbon_intensity_g_per_kwh, ${copCol}, is_net_zero_certified, allocated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.allocationRef,
      input.powerSourceType,
      input.allocatedMegawatts,
      input.carbonIntensityGPerKwh,
      input.copValue,
      input.isCompliant ? 1 : 0,
      input.allocatedAt ?? new Date().toISOString()
    )
    .run();
}

export async function recordStandardSlaD1(input: RecordStandardSlaD1Input): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, audit_ref, evaluation_period_month, total_eval_seconds,
         downtime_nanoseconds, achieved_availability_pct, ${input.metCol},
         bft_consensus_nodes, auditor_hash, audited_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      input.auditRef,
      input.evaluationPeriodMonth,
      2592000,
      input.actualDowntimeNanoseconds,
      input.effectiveAvailabilityPct,
      input.isMet ? 1 : 0,
      input.bftConsensusNodes,
      input.auditSignature,
      input.auditedAt ?? new Date().toISOString()
    )
    .run();
}
