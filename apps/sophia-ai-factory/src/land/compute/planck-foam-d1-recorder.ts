/**
 * @file planck-foam-d1-recorder.ts
 * @layer land/compute
 * @description Shared D1 persistence helper for Planck and Sub-Planck Quantum Foam workload dispatches, power allocations, and Sixteen/Seventeen-Nines SLA audits.
 */

import { getD1 } from '@/seed/db/client';

export interface PlanckFoamDispatchRecordInput {
  tableName: 'continuum_pipeline_dispatches' | 'multiverse_pipeline_dispatches';
  dispatchRefPrefix: string;
  dispatchHash: string;
  targetLatticeRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  dispatchLatencyNanos: number;
  planckDriftFs: number;
}

export interface PlanckFoamPowerAllocationRecordInput {
  tableName: 'quantum_foam_power_allocations' | 'sub_planck_power_allocations';
  allocationRefPrefix: string;
  powerSourceType: 'ZERO_POINT_FOAM_TAP' | 'SUB_PLANCK_ZERO_POINT_HARVESTER';
  allocatedMegawatts: number;
  carbonIntensityGPerKwh: number;
  boseEinsteinCop: number;
  isCompliant: boolean;
}

export interface PlanckFoamSlaAuditRecordInput {
  tableName: 'sixteen_nines_sla_audits' | 'seventeen_nines_sla_audits';
  auditRefPrefix: string;
  metColumnName: 'is_sixteen_nines_met' | 'is_seventeen_nines_met';
  month: string;
  actualDowntimeNanoseconds: number;
  effectiveAvailabilityPct: number;
  isMet: boolean;
  bftConsensusNodes: number;
  auditSignature: string;
}

export async function recordPlanckFoamDispatchD1(p: PlanckFoamDispatchRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, dispatch_ref, session_token, lattice_ref, pipeline_job_count, data_volume_petabytes, dispatch_latency_nanos, drift_compensation_fs, dispatch_status, dispatched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      `${p.dispatchRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      p.dispatchHash, p.targetLatticeRef, p.assignedWorkloads, p.totalBandwidthPetabytes,
      p.dispatchLatencyNanos, p.planckDriftFs, 'COMPLETED_SYNCHRONOUS', new Date().toISOString()
    )
    .run();
}

export async function recordPlanckFoamPowerAllocationD1(
  p: PlanckFoamPowerAllocationRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, allocation_ref, power_source_type, megawatts_allocated, carbon_intensity_g_per_kwh, bose_einstein_cop, is_net_zero_certified, allocated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      `${p.allocationRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      p.powerSourceType, p.allocatedMegawatts, p.carbonIntensityGPerKwh,
      p.boseEinsteinCop, p.isCompliant ? 1 : 0, new Date().toISOString()
    )
    .run();
}

export async function recordPlanckFoamSlaAuditD1(p: PlanckFoamSlaAuditRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, audit_ref, evaluation_period_month, total_eval_seconds, downtime_nanoseconds, achieved_availability_pct, ${p.metColumnName}, bft_consensus_nodes, auditor_hash, audited_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      `${p.auditRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      p.month, 2592000, p.actualDowntimeNanoseconds, p.effectiveAvailabilityPct,
      p.isMet ? 1 : 0, p.bftConsensusNodes, p.auditSignature, new Date().toISOString()
    )
    .run();
}
