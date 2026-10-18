/**
 * Core GPU Mesh Entity & Row Types
 *
 * Layer: seed/types/gpu-mesh
 */

export type GpuMeshRegion = 'apac' | 'us' | 'eu';

export type ReservationStatus =
  | 'provisioning'
  | 'active'
  | 'degraded'
  | 'suspended'
  | 'terminated';

export type CircuitBreakerState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

export type RegionHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type BreachType =
  | 'uptime'
  | 'latency_p95'
  | 'capacity_starvation'
  | 'cascading_failover';

export type CompensationRail = 'MCU_CREDIT' | 'USDT_REFUND' | 'INVOICE_CREDIT';

export type RefundStatus = 'pending' | 'approved' | 'disbursed' | 'rejected';

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

export type {
  FailoverRouteResult,
  LaneAllocationResult,
  CreateReservationInput,
  UpdateReservationInput,
} from './reservation-input-types';
