/**
 * Persistence and parameter builder helper for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/reservation-creator-helper
 */

import type { getD1 } from '@/seed/db/client';
import type { CreateReservationInput } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';

export interface ResolvedReservationRecord {
  id: string;
  orgId: string;
  dealId: string | null;
  contractId: string | null;
  laneId: string;
  primaryRegion: string;
  fallbackRegionsJson: string;
  reservedUnits: number;
  concurrencyLimit: number;
  mcuMonthlyAllocation: number;
  priorityScore: number;
  slaUptimeTarget: number;
  slaP95LatencyMs: number;
  slaDegradationWindowSecs: number;
  slaRefundPct: number;
  allocatedProvidersJson: string;
  activeFrom: number;
  activeUntil: number;
  metadataJson: string;
  now: number;
}

export function buildReservationRecord(
  id: string,
  input: CreateReservationInput,
  now: number,
): ResolvedReservationRecord {
  const laneId =
    input.laneId ||
    `lane_dedicated_${input.orgId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    orgId: input.orgId,
    dealId: input.dealId ?? null,
    contractId: input.contractId ?? null,
    laneId,
    primaryRegion: input.primaryRegion || 'apac',
    fallbackRegionsJson: JSON.stringify(input.fallbackRegions || ['us', 'eu']),
    reservedUnits: input.reservedUnits || GPU_MESH_SLA_CONFIG.defaultReservedUnits,
    concurrencyLimit: input.concurrencyLimit || GPU_MESH_SLA_CONFIG.defaultConcurrencyLimit,
    mcuMonthlyAllocation: input.mcuMonthlyAllocation || GPU_MESH_SLA_CONFIG.defaultMonthlyMcu,
    priorityScore: input.priorityScore || GPU_MESH_SLA_CONFIG.dedicatedLanePriorityScore,
    slaUptimeTarget: input.slaUptimeTarget || GPU_MESH_SLA_CONFIG.defaultUptimeTarget,
    slaP95LatencyMs: input.slaP95LatencyMs || GPU_MESH_SLA_CONFIG.defaultP95LatencyCeilingMs,
    slaDegradationWindowSecs:
      input.slaDegradationWindowSecs || GPU_MESH_SLA_CONFIG.defaultEvaluationWindowSecs,
    slaRefundPct: input.slaRefundPct || GPU_MESH_SLA_CONFIG.defaultRefundPct,
    allocatedProvidersJson: JSON.stringify(input.allocatedProviders || ['fal', 'runpod', 'mekong']),
    activeFrom: input.activeFrom || now,
    activeUntil: input.activeUntil,
    metadataJson: JSON.stringify(input.metadata ?? {}),
    now,
  };
}

export async function insertGpuReservationRow(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  rec: ResolvedReservationRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO enterprise_gpu_reservations (
        id, org_id, deal_id, contract_id, lane_id,
        primary_region, fallback_regions, reserved_units, concurrency_limit,
        mcu_monthly_allocation, mcu_consumed, priority_score, status,
        sla_uptime_target, sla_p95_latency_ms, sla_degradation_window_secs, sla_refund_pct,
        allocated_providers, active_from, active_until, metadata,
        created_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5,
        ?6, ?7, ?8, ?9,
        ?10, 0, ?11, 'active',
        ?12, ?13, ?14, ?15,
        ?16, ?17, ?18, ?19,
        ?20, ?21
      )`,
    )
    .bind(
      rec.id,
      rec.orgId,
      rec.dealId,
      rec.contractId,
      rec.laneId,
      rec.primaryRegion,
      rec.fallbackRegionsJson,
      rec.reservedUnits,
      rec.concurrencyLimit,
      rec.mcuMonthlyAllocation,
      rec.priorityScore,
      rec.slaUptimeTarget,
      rec.slaP95LatencyMs,
      rec.slaDegradationWindowSecs,
      rec.slaRefundPct,
      rec.allocatedProvidersJson,
      rec.activeFrom,
      rec.activeUntil,
      rec.metadataJson,
      rec.now,
      rec.now,
    )
    .run();
}
