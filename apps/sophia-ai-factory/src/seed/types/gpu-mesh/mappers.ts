/**
 * D1 Row to Domain Entity Mappers for GPU Mesh
 *
 * Layer: seed/types/gpu-mesh
 */

import type {
  EnterpriseGpuReservationRow,
  EnterpriseGpuReservation,
  GpuMeshRegion,
  GpuMeshRegionHealthRow,
  GpuMeshRegionHealth,
} from './types';
import type {
  SlaDegradationIncidentRow,
  SlaDegradationIncident,
} from './sla-types';
import { isGpuMeshRegion } from './guards';

export function mapRowToReservation(row: EnterpriseGpuReservationRow): EnterpriseGpuReservation {
  let fallbackRegions: GpuMeshRegion[] = ['us', 'eu'];
  try {
    const parsed = JSON.parse(row.fallback_regions);
    if (Array.isArray(parsed)) {
      fallbackRegions = parsed.filter(isGpuMeshRegion);
    }
  } catch {
    fallbackRegions = ['us', 'eu'];
  }

  let allocatedProviders: string[] = ['fal', 'runpod', 'mekong'];
  try {
    const parsed = JSON.parse(row.allocated_providers);
    if (Array.isArray(parsed)) {
      allocatedProviders = parsed.map(String);
    }
  } catch {
    allocatedProviders = ['fal', 'runpod', 'mekong'];
  }

  let metadata: Record<string, unknown> = {};
  try {
    if (row.metadata) {
      metadata = JSON.parse(row.metadata);
    }
  } catch {
    metadata = {};
  }

  return {
    id: row.id,
    orgId: row.org_id,
    dealId: row.deal_id,
    contractId: row.contract_id,
    laneId: row.lane_id,
    primaryRegion: row.primary_region,
    fallbackRegions,
    reservedUnits: row.reserved_units,
    concurrencyLimit: row.concurrency_limit,
    mcuMonthlyAllocation: row.mcu_monthly_allocation,
    mcuConsumed: row.mcu_consumed,
    priorityScore: row.priority_score,
    status: row.status,
    slaUptimeTarget: row.sla_uptime_target,
    slaP95LatencyMs: row.sla_p95_latency_ms,
    slaDegradationWindowSecs: row.sla_degradation_window_secs,
    slaRefundPct: row.sla_refund_pct,
    allocatedProviders,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToIncident(row: SlaDegradationIncidentRow): SlaDegradationIncident {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    orgId: row.org_id,
    breachType: row.breach_type,
    region: row.region,
    targetThreshold: row.target_threshold,
    measuredValue: row.measured_value,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    durationSeconds: row.duration_seconds,
    impactedJobsCount: row.impacted_jobs_count,
    creditAmountCents: row.credit_amount_cents,
    compensationRail: row.compensation_rail,
    refundStatus: row.refund_status,
    refundLedgerId: row.refund_ledger_id,
    detectedBy: row.detected_by,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToRegionHealth(row: GpuMeshRegionHealthRow): GpuMeshRegionHealth {
  let probeDetails: Record<string, unknown> = {};
  try {
    if (row.probe_details) {
      probeDetails = JSON.parse(row.probe_details);
    }
  } catch {
    probeDetails = {};
  }

  return {
    region: row.region,
    healthStatus: row.health_status,
    p95LatencyMs: row.p95_latency_ms,
    errorRatePct: row.error_rate_pct,
    activeReservations: row.active_reservations,
    availableCapacityPct: row.available_capacity_pct,
    circuitBreakerState: row.circuit_breaker_state,
    lastProbeAt: row.last_probe_at,
    probeDetails,
    updatedAt: row.updated_at,
  };
}
