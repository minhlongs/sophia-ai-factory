/**
 * @file exaflop-matrix-persistence.ts
 * @layer land/compute
 * @description D1 persistence helpers for ExaFLOP Compute Matrix workload batches and Eight-Nines SLA records.
 */

import { getD1 } from '@/seed/db/client';
import type {
  PlanetaryDispatchPlan,
  EightNinesSlaRecord,
} from '@/seed/types/exaflop-matrix';

export async function persistPlanetaryBatch(
  batchUuid: string,
  totalWorkloads: number,
  plan: PlanetaryDispatchPlan
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO planetary_workload_batches (
         id, batch_uuid, total_jobs, completed_jobs, failed_jobs,
         allocated_clusters_count, dispatch_latency_ms, batch_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `batch_${batchUuid}`,
      batchUuid,
      totalWorkloads,
      0,
      0,
      plan.clusterAllocations.length,
      plan.projectedDispatchLatencyMs,
      'SCHEDULED'
    )
    .run();
}

export async function persistEightNinesSlaRecord(
  record: EightNinesSlaRecord
): Promise<void> {
  const db = await getD1();
  if (!db) return;

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
