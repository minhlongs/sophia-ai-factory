/**
 * GPU Mesh Routing & Reservation Input/Result Types
 *
 * Layer: seed/types/gpu-mesh
 */

import type {
  CircuitBreakerState,
  GpuMeshRegion,
  ReservationStatus,
} from './types';

export interface FailoverRouteResult {
  selectedRegion: GpuMeshRegion;
  isFailover: boolean;
  failoverHops: number;
  reason: string;
  p95LatencyMs?: number;
  circuitBreakerState?: CircuitBreakerState;
}

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
