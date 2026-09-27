'use server';

/**
 * @file exaflop-matrix-actions.ts
 * @layer land/compute
 * @description Land layer Server Actions for ExaFLOP Compute Matrix dispatch and Eight-Nines SLA tracking.
 */

import { getD1 } from '@/seed/db/client';
import {
  planPlanetaryWorkloadDispatch,
  evaluateEightNinesSla,
} from '@/tree/compute/exaflop-matrix-engine';
import { routeOrbitalTransmission } from '@/tree/orbital/deep-space-relay-engine';
import type {
  ExaflopComputeCluster,
  PlanetaryDispatchPlan,
  EightNinesSlaRecord,
  OrbitalRelayNode,
  OpticalTransmissionRequest,
  OpticalTransmissionResult,
} from '@/seed/types/exaflop-matrix';

export interface DispatchPlanetaryActionParams {
  batchUuid: string;
  totalWorkloads: number;
  clusters: ExaflopComputeCluster[];
}

export interface DispatchPlanetaryActionResult {
  success: boolean;
  plan?: PlanetaryDispatchPlan;
  error?: string;
}

export async function dispatchPlanetaryWorkloadAction(
  params: DispatchPlanetaryActionParams
): Promise<DispatchPlanetaryActionResult> {
  try {
    const plan = planPlanetaryWorkloadDispatch(params.totalWorkloads, params.clusters);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO planetary_workload_batches (
             id, batch_uuid, total_jobs, completed_jobs, failed_jobs,
             allocated_clusters_count, dispatch_latency_ms, batch_status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `batch_${params.batchUuid}`,
          params.batchUuid,
          params.totalWorkloads,
          0,
          0,
          plan.clusterAllocations.length,
          plan.projectedDispatchLatencyMs,
          'SCHEDULED'
        )
        .run();
    }

    return { success: true, plan };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface RecordEightNinesSlaActionParams {
  periodIdentifier: string;
  downtimeMs: number;
}

export interface RecordEightNinesSlaActionResult {
  success: boolean;
  record?: EightNinesSlaRecord;
  error?: string;
}

export async function recordEightNinesSlaAction(
  params: RecordEightNinesSlaActionParams
): Promise<RecordEightNinesSlaActionResult> {
  try {
    const record = evaluateEightNinesSla(params.periodIdentifier, params.downtimeMs);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO eight_nines_sla_records (
             id, period_identifier, total_target_seconds, recorded_downtime_ms,
             availability_percentage, sla_breached, byzantine_quorum_signatures,
             audit_merkle_root
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(period_identifier) DO UPDATE SET
             recorded_downtime_ms = ?,
             availability_percentage = ?,
             sla_breached = ?`
        )
        .bind(
          record.id,
          record.periodIdentifier,
          record.totalTargetSeconds,
          record.recordedDowntimeMs,
          record.availabilityPercentage,
          record.slaBreached ? 1 : 0,
          record.byzantineQuorumSignatures,
          record.auditMerkleRoot,
          record.recordedDowntimeMs,
          record.availabilityPercentage,
          record.slaBreached ? 1 : 0
        )
        .run();
    }

    return { success: true, record };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface RouteOrbitalLaserActionParams {
  node: OrbitalRelayNode;
  request: OpticalTransmissionRequest;
}

export interface RouteOrbitalLaserActionResult {
  success: boolean;
  result?: OpticalTransmissionResult;
  error?: string;
}

export async function routeOrbitalLaserAction(
  params: RouteOrbitalLaserActionParams
): Promise<RouteOrbitalLaserActionResult> {
  try {
    const result = routeOrbitalTransmission(params.node, params.request);
    return { success: true, result };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
