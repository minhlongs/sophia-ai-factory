/**
 * @file sub-planck-mesh-d1-recorder.ts
 * @layer land/compute
 * @description Shared D1 persistence helper for Sub-Planck Singularity Mesh dispatch, power allocation, and SLA audit actions.
 */

import { getD1 } from '@/seed/db/client';

export interface RecordSubPlanckDispatchInput {
  table: string;
  refPrefix: string;
  targetMeshRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  latencyNanos: number;
  relativisticDriftFs: number;
}

export interface RecordSubPlanckPowerInput {
  table: string;
  refPrefix: string;
  powerSourceType: string;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface RecordSubPlanckSlaAuditInput {
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

export async function recordSubPlanckDispatchD1(input: RecordSubPlanckDispatchInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, dispatch_ref, session_token, mesh_ref,
         pipeline_job_count, data_volume_petabytes, dispatch_latency_nanos,
         drift_compensation_fs, dispatch_status, dispatched_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      `${input.refPrefix}-${Date.now()}-${randomSuffix()}`,
      `SESSION-${Date.now()}`,
      input.targetMeshRef,
      input.assignedWorkloads,
      input.totalBandwidthPetabytes,
      input.latencyNanos,
      input.relativisticDriftFs,
      'COMPLETED_SYNCHRONOUS'
    )
    .run();
}

export async function recordSubPlanckPowerAllocationD1(input: RecordSubPlanckPowerInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, allocation_ref, power_source_type, megawatts_allocated,
         carbon_intensity_g_per_kwh, bose_einstein_cop, is_net_zero_certified,
         allocated_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      `${input.refPrefix}-${Date.now()}-${randomSuffix()}`,
      input.powerSourceType,
      input.allocatedMegawatts,
      input.carbonIntensityGPerKwh,
      input.boseEinsteinCop,
      input.isNetZeroCertified ? 1 : 0
    )
    .run();
}

export async function recordSubPlanckSlaAuditD1(input: RecordSubPlanckSlaAuditInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (
         id, audit_ref, evaluation_period_month, total_eval_seconds,
         downtime_nanoseconds, achieved_availability_pct, ${input.metColumn},
         bft_consensus_nodes, auditor_hash, audited_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
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
      input.auditSignature
    )
    .run();
}
