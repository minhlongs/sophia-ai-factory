/**
 * @file mesh-actions-d1-recorder.ts
 * @layer land/compute
 * @description Shared D1 persistence helper for Singularity Mesh dispatch, power allocation, and SLA audit actions.
 */

import { getD1 } from '@/seed/db/client';

export interface RecordMeshDispatchInput {
  table: string;
  refPrefix: string;
  tokenPrefix: string;
  targetMeshRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  latencyNanos: number;
  relativisticDriftFs: number;
}

export interface RecordMeshPowerInput {
  table: string;
  refPrefix: string;
  powerSourceType: string;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isCompliant: boolean;
}

export interface RecordMeshSlaAuditInput {
  table: string;
  metColumn: string;
  refPrefix: string;
  evaluationPeriodMonth: string;
  actualDowntimeNanoseconds: number;
  effectiveAvailabilityPct: number;
  isSlaMet: boolean;
  bftConsensusNodes: number;
  auditSignature: string;
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 7);
}

export async function recordMeshBatchDispatchD1(input: RecordMeshDispatchInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  const nowMs = Date.now();
  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, dispatch_ref, session_token, mesh_ref,
         pipeline_job_count, data_volume_petabytes, dispatch_latency_nanos,
         drift_compensation_fs, dispatch_status, dispatched_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      `${input.refPrefix}-${nowMs}-${randomSuffix()}`,
      `${input.tokenPrefix}-${nowMs}`,
      input.targetMeshRef,
      input.assignedWorkloads,
      input.totalBandwidthPetabytes,
      input.latencyNanos,
      input.relativisticDriftFs,
      'COMPLETED_SYNCHRONOUS',
      new Date().toISOString()
    )
    .run();
}

export async function recordMeshPowerAllocationD1(input: RecordMeshPowerInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, allocation_ref, power_source_type, megawatts_allocated,
         carbon_intensity_g_per_kwh, bose_einstein_cop, is_net_zero_certified, allocated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      `${input.refPrefix}-${Date.now()}-${randomSuffix()}`,
      input.powerSourceType,
      input.allocatedMegawatts,
      input.carbonIntensityGPerKwh,
      input.boseEinsteinCop,
      input.isCompliant ? 1 : 0,
      new Date().toISOString()
    )
    .run();
}

export async function recordMeshSlaAuditD1(input: RecordMeshSlaAuditInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, audit_ref, evaluation_period_month, total_eval_seconds,
         downtime_nanoseconds, achieved_availability_pct, ${input.metColumn},
         bft_consensus_nodes, auditor_hash, audited_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      `${input.refPrefix}-${Date.now()}-${randomSuffix()}`,
      input.evaluationPeriodMonth,
      2592000,
      input.actualDowntimeNanoseconds,
      input.effectiveAvailabilityPct,
      input.isSlaMet ? 1 : 0,
      input.bftConsensusNodes,
      input.auditSignature,
      new Date().toISOString()
    )
    .run();
}
