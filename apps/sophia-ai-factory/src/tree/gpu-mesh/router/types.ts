import type { GpuMeshRegion } from '@/seed/types/gpu-mesh';

export interface RegionTelemetryUpdate {
  region: GpuMeshRegion;
  p95LatencyMs?: number;
  errorRatePct?: number;
  activeReservations?: number;
  availableCapacityPct?: number;
  probeDetails?: Record<string, unknown>;
  probeTimestamp?: number;
}
