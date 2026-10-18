/**
 * @file milliaquadrillion-sub-planck-d1-recorder.ts
 * @layer land/compute
 * @description Shared D1 persistence helper for Millia-Quadrillion and Centum-Quintillion Sub-Planck Singularity Mesh dispatches, power allocations, and SLA audits.
 */

import { getD1 } from '@/seed/db/client';

export interface MilliaquadrillionSubPlanckDispatchRecordInput {
  table: string;
  refPrefix: string;
  tokenPrefix: string;
  targetMeshRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  latencyNanos: number;
  relativisticDriftFs: number;
}

export interface MilliaquadrillionSubPlanckPowerRecordInput {
  table: string;
  refPrefix: string;
  powerSourceType: string;
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isNetZeroCertified: boolean;
}

export interface MilliaquadrillionSubPlanckSlaAuditRecordInput {
  table: string;
  metColumn: string;
  refPrefix: string;
  actualDowntimeNanoseconds: number;
  effectiveAvailabilityPct: number;
  isSlaMet: boolean;
  bftConsensusNodes: number;
  auditSignature: string;
}

function buildRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export async function recordMilliaquadrillionSubPlanckDispatchD1(
  input: MilliaquadrillionSubPlanckDispatchRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (id, dispatch_ref, session_token, mesh_ref, pipeline_job_count, data_volume_petabytes, dispatch_latency_nanos, drift_compensation_fs, dispatch_status, dispatched_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED_SYNCHRONOUS', datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      buildRef(input.refPrefix),
      `${input.tokenPrefix}-${Date.now()}`,
      input.targetMeshRef,
      input.assignedWorkloads,
      input.totalBandwidthPetabytes,
      input.latencyNanos,
      input.relativisticDriftFs
    )
    .run();
}

export async function recordMilliaquadrillionSubPlanckPowerD1(
  input: MilliaquadrillionSubPlanckPowerRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (id, allocation_ref, power_source_type, megawatts_allocated, carbonIntensity_g_per_kwh, bose_einstein_cop, is_net_zero_certified, allocated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      buildRef(input.refPrefix),
      input.powerSourceType,
      input.allocatedMegawatts,
      input.carbonIntensityGPerKwh,
      input.boseEinsteinCop,
      input.isNetZeroCertified ? 1 : 0
    )
    .run();
}

export async function recordMilliaquadrillionSubPlanckSlaAuditD1(
  input: MilliaquadrillionSubPlanckSlaAuditRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${input.table} (id, audit_ref, evaluation_period_month, total_eval_seconds, downtime_nanoseconds, achieved_availability_pct, ${input.metColumn}, bft_consensus_nodes, auditor_hash, audited_at, created_at) VALUES (?, ?, strftime('%Y-%m', 'now'), 2592000, ?, ?, ?, ${input.bftConsensusNodes}, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      buildRef(input.refPrefix),
      input.actualDowntimeNanoseconds,
      input.effectiveAvailabilityPct,
      input.isSlaMet ? 1 : 0,
      input.auditSignature
    )
    .run();
}
