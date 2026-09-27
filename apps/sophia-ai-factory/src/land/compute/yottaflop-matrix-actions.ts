'use server';

/**
 * @file yottaflop-matrix-actions.ts
 * @layer land/compute
 * @description Land layer Server Actions for YottaFLOP Super-Scale Quantum Grid dispatch and Nine-Nines SLA tracking.
 */

import { getD1 } from '@/seed/db/client';
import { planQuantumBatchDispatch } from '@/tree/compute/yottaflop-scheduler-engine';
import { evaluateNineNinesSla } from '@/tree/energy/dyson-power-engine';
import type {
  YottaflopComputeGrid,
  PlanetaryQuantumDispatchPlan,
  NineNinesSlaAudit,
} from '@/seed/types/yottaflop-matrix';

export interface DispatchQuantumBatchActionParams {
  batchId: string;
  totalJobs: number;
  grids: YottaflopComputeGrid[];
}

export interface DispatchQuantumBatchActionResult {
  success: boolean;
  plan?: PlanetaryQuantumDispatchPlan;
  error?: string;
}

export async function dispatchQuantumBatchAction(
  params: DispatchQuantumBatchActionParams
): Promise<DispatchQuantumBatchActionResult> {
  try {
    const plan = planQuantumBatchDispatch(params.totalJobs, params.grids);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO quantum_pipeline_batches (
             id, batch_id, total_jobs, completed_jobs, failed_jobs,
             quantum_circuits_executed, p99_latency_microseconds, dispatch_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `qbatch_${params.batchId}`,
          params.batchId,
          params.totalJobs,
          0,
          0,
          Math.round(params.totalJobs * 0.25),
          plan.projectedDispatchLatencyMicroseconds,
          'ORCHESTRATING'
        )
        .run();
    }

    return { success: true, plan };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface RecordNineNinesSlaActionParams {
  periodIdentifier: string;
  downtimeMicroseconds: number;
}

export interface RecordNineNinesSlaActionResult {
  success: boolean;
  audit?: NineNinesSlaAudit;
  error?: string;
}

export async function recordNineNinesSlaAction(
  params: RecordNineNinesSlaActionParams
): Promise<RecordNineNinesSlaActionResult> {
  try {
    const audit = evaluateNineNinesSla(params.periodIdentifier, params.downtimeMicroseconds);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO nine_nines_sla_audits (
             id, period_identifier, target_seconds, recorded_downtime_microseconds,
             availability_percentage, sla_breached, quantum_teleportation_sync_valid,
             byzantine_validators_count, audit_proof_root
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(period_identifier) DO UPDATE SET
             recorded_downtime_microseconds = ?,
             availability_percentage = ?,
             sla_breached = ?,
             quantum_teleportation_sync_valid = ?`
        )
        .bind(
          audit.id,
          audit.periodIdentifier,
          audit.targetSeconds,
          audit.recordedDowntimeMicroseconds,
          audit.availabilityPercentage,
          audit.slaBreached ? 1 : 0,
          audit.quantumTeleportationSyncValid ? 1 : 0,
          audit.byzantineValidatorsCount,
          audit.auditProofRoot,
          audit.recordedDowntimeMicroseconds,
          audit.availabilityPercentage,
          audit.slaBreached ? 1 : 0,
          audit.quantumTeleportationSyncValid ? 1 : 0
        )
        .run();
    }

    return { success: true, audit };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
