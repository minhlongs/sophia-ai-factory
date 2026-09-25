/**
 * Global Multi-Region GPU Mesh & Dedicated Lane Allocation Types
 *
 * Layer: seed/types (Foundational — zero external runtime dependencies, 0 upper layer imports)
 *
 * @module seed/types/gpu-mesh
 */

export type GpuMeshRegion = 'apac' | 'us' | 'eu';

export const ALL_GPU_MESH_REGIONS: readonly GpuMeshRegion[] = ['apac', 'us', 'eu'] as const;

export function isGpuMeshRegion(value: unknown): value is GpuMeshRegion {
  return typeof value === 'string' && ALL_GPU_MESH_REGIONS.includes(value as GpuMeshRegion);
}

export type ReservationStatus =
  | 'provisioning'
  | 'active'
  | 'degraded'
  | 'suspended'
  | 'terminated';

export const ALL_RESERVATION_STATUSES: readonly ReservationStatus[] = [
  'provisioning',
  'active',
  'degraded',
  'suspended',
  'terminated',
] as const;

export function isReservationStatus(value: unknown): value is ReservationStatus {
  return typeof value === 'string' && ALL_RESERVATION_STATUSES.includes(value as ReservationStatus);
}

export type CircuitBreakerState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export const ALL_CIRCUIT_BREAKER_STATES: readonly CircuitBreakerState[] = [
  'CLOSED',
  'HALF_OPEN',
  'OPEN',
] as const;

export function isCircuitBreakerState(value: unknown): value is CircuitBreakerState {
  return (
    typeof value === 'string' && ALL_CIRCUIT_BREAKER_STATES.includes(value as CircuitBreakerState)
  );
}

export type RegionHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export const ALL_REGION_HEALTH_STATUSES: readonly RegionHealthStatus[] = [
  'healthy',
  'degraded',
  'unhealthy',
] as const;

export function isRegionHealthStatus(value: unknown): value is RegionHealthStatus {
  return (
    typeof value === 'string' && ALL_REGION_HEALTH_STATUSES.includes(value as RegionHealthStatus)
  );
}

export type BreachType =
  | 'uptime'
  | 'latency_p95'
  | 'capacity_starvation'
  | 'cascading_failover';

export const ALL_BREACH_TYPES: readonly BreachType[] = [
  'uptime',
  'latency_p95',
  'capacity_starvation',
  'cascading_failover',
] as const;

export function isBreachType(value: unknown): value is BreachType {
  return typeof value === 'string' && ALL_BREACH_TYPES.includes(value as BreachType);
}

export type CompensationRail = 'MCU_CREDIT' | 'USDT_REFUND' | 'INVOICE_CREDIT';

export const ALL_COMPENSATION_RAILS: readonly CompensationRail[] = [
  'MCU_CREDIT',
  'USDT_REFUND',
  'INVOICE_CREDIT',
] as const;

export function isCompensationRail(value: unknown): value is CompensationRail {
  return typeof value === 'string' && ALL_COMPENSATION_RAILS.includes(value as CompensationRail);
}

export type RefundStatus = 'pending' | 'approved' | 'disbursed' | 'rejected';

export const ALL_REFUND_STATUSES: readonly RefundStatus[] = [
  'pending',
  'approved',
  'disbursed',
  'rejected',
] as const;

export function isRefundStatus(value: unknown): value is RefundStatus {
  return typeof value === 'string' && ALL_REFUND_STATUSES.includes(value as RefundStatus);
}

/**
 * Raw D1 Database Row for enterprise_gpu_reservations
 */
export interface EnterpriseGpuReservationRow {
  id: string;
  org_id: string;
  deal_id: string | null;
  contract_id: string | null;
  lane_id: string;
  primary_region: GpuMeshRegion;
  fallback_regions: string; // JSON array of GpuMeshRegion
  reserved_units: number;
  concurrency_limit: number;
  mcu_monthly_allocation: number;
  mcu_consumed: number;
  priority_score: number;
  status: ReservationStatus;
  sla_uptime_target: number;
  sla_p95_latency_ms: number;
  sla_degradation_window_secs: number;
  sla_refund_pct: number;
  allocated_providers: string; // JSON array of string
  active_from: number;
  active_until: number;
  metadata: string | null; // JSON object
  created_at: number;
  updated_at: number;
}

/**
 * Domain entity for Enterprise GPU Reservation
 */
export interface EnterpriseGpuReservation {
  id: string;
  orgId: string;
  dealId?: string | null;
  contractId?: string | null;
  laneId: string;
  primaryRegion: GpuMeshRegion;
  fallbackRegions: GpuMeshRegion[];
  reservedUnits: number;
  concurrencyLimit: number;
  mcuMonthlyAllocation: number;
  mcuConsumed: number;
  priorityScore: number;
  status: ReservationStatus;
  slaUptimeTarget: number;
  slaP95LatencyMs: number;
  slaDegradationWindowSecs: number;
  slaRefundPct: number;
  allocatedProviders: string[];
  activeFrom: number;
  activeUntil: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Raw D1 Database Row for gpu_mesh_region_health
 */
export interface GpuMeshRegionHealthRow {
  region: GpuMeshRegion;
  health_status: RegionHealthStatus;
  p95_latency_ms: number;
  error_rate_pct: number;
  active_reservations: number;
  available_capacity_pct: number;
  circuit_breaker_state: CircuitBreakerState;
  last_probe_at: number;
  probe_details: string | null;
  updated_at: number;
}

/**
 * Domain entity for GPU Mesh Region Health & Telemetry
 */
export interface GpuMeshRegionHealth {
  region: GpuMeshRegion;
  healthStatus: RegionHealthStatus;
  p95LatencyMs: number;
  errorRatePct: number;
  activeReservations: number;
  availableCapacityPct: number;
  circuitBreakerState: CircuitBreakerState;
  lastProbeAt: number;
  probeDetails: Record<string, unknown>;
  updatedAt: number;
}

/**
 * Raw D1 Database Row for sla_degradation_incidents
 */
export interface SlaDegradationIncidentRow {
  id: string;
  reservation_id: string;
  org_id: string;
  breach_type: BreachType;
  region: GpuMeshRegion;
  target_threshold: number;
  measured_value: number;
  started_at: number;
  resolved_at: number | null;
  duration_seconds: number | null;
  impacted_jobs_count: number;
  credit_amount_cents: number;
  compensation_rail: CompensationRail;
  refund_status: RefundStatus;
  refund_ledger_id: string | null;
  detected_by: string;
  resolution_notes: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Domain entity for SLA Degradation Incident
 */
export interface SlaDegradationIncident {
  id: string;
  reservationId: string;
  orgId: string;
  breachType: BreachType;
  region: GpuMeshRegion;
  targetThreshold: number;
  measuredValue: number;
  startedAt: number;
  resolvedAt?: number | null;
  durationSeconds?: number | null;
  impactedJobsCount: number;
  creditAmountCents: number;
  compensationRail: CompensationRail;
  refundStatus: RefundStatus;
  refundLedgerId?: string | null;
  detectedBy: string;
  resolutionNotes?: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Failover routing result
 */
export interface FailoverRouteResult {
  selectedRegion: GpuMeshRegion;
  isFailover: boolean;
  failoverHops: number;
  reason: string;
  p95LatencyMs?: number;
  circuitBreakerState?: CircuitBreakerState;
}

/**
 * Dedicated lane allocation result
 */
export interface LaneAllocationResult {
  success: boolean;
  jobId: string;
  reservationId?: string;
  lane: 'priority';
  priorityScore: number;
  allocatedRegion?: GpuMeshRegion;
  reason?: string;
  activeJobs?: number;
  concurrencyLimit?: number;
}

/**
 * Input for creating a new enterprise GPU reservation
 */
export interface CreateReservationInput {
  orgId: string;
  dealId?: string | null;
  contractId?: string | null;
  laneId?: string;
  primaryRegion?: GpuMeshRegion;
  fallbackRegions?: GpuMeshRegion[];
  reservedUnits?: number;
  concurrencyLimit?: number;
  mcuMonthlyAllocation?: number;
  priorityScore?: number;
  slaUptimeTarget?: number;
  slaP95LatencyMs?: number;
  slaDegradationWindowSecs?: number;
  slaRefundPct?: number;
  allocatedProviders?: string[];
  activeFrom?: number;
  activeUntil: number;
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating an enterprise GPU reservation
 */
export interface UpdateReservationInput {
  status?: ReservationStatus;
  reservedUnits?: number;
  concurrencyLimit?: number;
  mcuMonthlyAllocation?: number;
  priorityScore?: number;
  primaryRegion?: GpuMeshRegion;
  fallbackRegions?: GpuMeshRegion[];
  slaUptimeTarget?: number;
  slaP95LatencyMs?: number;
  slaRefundPct?: number;
  allocatedProviders?: string[];
  activeUntil?: number;
  metadata?: Record<string, unknown>;
}

/**
 * SLI Measurement over a sliding window
 */
export interface SliMeasurement {
  reservationId: string;
  orgId: string;
  region: GpuMeshRegion;
  windowStart: number;
  windowEnd: number;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  availabilityRatio: number; // e.g. 0.999 = 99.9%
  p95LatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  cascadingFailoverJobs: number;
  breaches: Array<{
    breachType: BreachType;
    targetThreshold: number;
    measuredValue: number;
  }>;
}

/**
 * Scan summary from the SLA refund monitor cron
 */
export interface SlaScanSummary {
  scannedReservations: number;
  incidentsDetected: number;
  incidentsDisbursed: number;
  totalCompensationMcu: number;
  totalCompensationCents: number;
  errors: string[];
}

/**
 * Maps raw D1 row to EnterpriseGpuReservation domain entity
 */
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

/**
 * Maps raw D1 row to SlaDegradationIncident domain entity
 */
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

/**
 * Maps raw D1 row to GpuMeshRegionHealth domain entity
 */
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
