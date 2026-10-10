/**
 * Type Guards & Allowed Constants for GPU Mesh
 *
 * Layer: seed/types/gpu-mesh
 */

import type {
  GpuMeshRegion,
  ReservationStatus,
  CircuitBreakerState,
  RegionHealthStatus,
  BreachType,
  CompensationRail,
  RefundStatus,
} from './types';

export const ALL_GPU_MESH_REGIONS: readonly GpuMeshRegion[] = ['apac', 'us', 'eu'] as const;

export function isGpuMeshRegion(value: unknown): value is GpuMeshRegion {
  return typeof value === 'string' && ALL_GPU_MESH_REGIONS.includes(value as GpuMeshRegion);
}

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

export const ALL_BREACH_TYPES: readonly BreachType[] = [
  'uptime',
  'latency_p95',
  'capacity_starvation',
  'cascading_failover',
] as const;

export function isBreachType(value: unknown): value is BreachType {
  return typeof value === 'string' && ALL_BREACH_TYPES.includes(value as BreachType);
}

export const ALL_COMPENSATION_RAILS: readonly CompensationRail[] = [
  'MCU_CREDIT',
  'USDT_REFUND',
  'INVOICE_CREDIT',
] as const;

export function isCompensationRail(value: unknown): value is CompensationRail {
  return typeof value === 'string' && ALL_COMPENSATION_RAILS.includes(value as CompensationRail);
}

export const ALL_REFUND_STATUSES: readonly RefundStatus[] = [
  'pending',
  'approved',
  'disbursed',
  'rejected',
] as const;

export function isRefundStatus(value: unknown): value is RefundStatus {
  return typeof value === 'string' && ALL_REFUND_STATUSES.includes(value as RefundStatus);
}
