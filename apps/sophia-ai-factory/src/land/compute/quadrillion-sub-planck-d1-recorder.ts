/**
 * @file quadrillion-sub-planck-d1-recorder.ts
 * @layer land/compute
 * @description Shared D1 persistence helper for Quadrillion-scale Sub-Planck Singularity Mesh dispatches, power allocations, and SLA audits.
 */

import { getD1 } from '@/seed/db/client';

export interface QuadrillionSubPlanckDispatchRecordInput {
  table: string;
  refPrefix: string;
  targetMeshRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  latencyNanos: number;
  relativisticDriftFs: number;
}

export interface QuadrillionSubPlanckPowerRecordInput {
  table: string;
  refPrefix: string;
  powerSourceType: string;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface QuadrillionSubPlanckSlaAuditRecordInput {
  table: string;
  metColumn: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  actualDowntimeNanoseconds: number;
  effectiveAvailabilityPct: number;
  isSlaMet: boolean;
  bftConsensusNodes: number;
  auditSignature: string;
}

export function buildQuadrillionRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export async function recordQuadrillionSubPlanckDispatchD1(
  input: QuadrillionSubPlanckDispatchRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (id, dispatch_ref, session_token, mesh_ref, pipeline_job_count, data_volume_petabytes, dispatch_latency_nanos, drift_compensation_fs, dispatch_status, dispatched_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      buildQuadrillionRef(input.refPrefix),
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

export async function recordQuadrillionSubPlanckPowerD1(
  input: QuadrillionSubPlanckPowerRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (id, allocation_ref, power_source_type, megawatts_allocated, carbon_intensity_g_per_kwh, bose_einstein_cop, is_net_zero_certified, allocated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      buildQuadrillionRef(input.refPrefix),
      input.powerSourceType,
      input.allocatedMegawatts,
      input.carbonIntensityGPerKwh,
      input.boseEinsteinCop,
      input.isNetZeroCertified ? 1 : 0
    )
    .run();
}

export async function recordQuadrillionSubPlanckSlaAuditD1(
  input: QuadrillionSubPlanckSlaAuditRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (id, audit_ref, evaluation_period_month, total_eval_seconds, downtime_nanoseconds, achieved_availability_pct, ${input.metColumn}, bft_consensus_nodes, auditor_hash, audited_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      input.auditRef,
      input.evaluationPeriodMonth,
      input.totalEvalSeconds,
      input.actualDowntimeNanoseconds,
      input.effectiveAvailabilityPct,
      input.isSlaMet ? 1 : 0,
      input.bftConsensusNodes,
      input.auditSignature
    )
    .run();
}
