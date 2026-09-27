/**
 * @file exaflop-matrix.ts
 * @layer seed/types
 * @description Seed types for Gate 13: ExaFLOP Hyper-Scale Planetary Compute Matrix & Autonomous Deep-Space Relay.
 */

export type ExaflopArchitectureClass =
  | 'BLACKWELL_B200_NVL72'
  | 'GRACE_HOPPER_GH200'
  | 'AMD_MI300X_POD'
  | 'APPLE_SILICON_M_MAX_MESH';

export type ExaflopClusterStatus =
  | 'OPTIMAL'
  | 'DEGRADED'
  | 'THERMAL_THROTTLED'
  | 'DRAINING'
  | 'OFFLINE';

export type DatacenterLocation =
  | 'ICELAND_GEOTHERMAL'
  | 'NORWAY_FJORDS'
  | 'SINGAPORE_UNDERWATER'
  | 'TEXAS_SOLAR'
  | 'ORBITAL_L2_RELAY';

export interface ExaflopComputeCluster {
  id: string;
  clusterRef: string;
  architectureClass: ExaflopArchitectureClass;
  totalFlopsExa: number; // e.g. 1.25 ExaFLOPs
  activeGpusCount: number;
  thermalEfficiencyPercentage: number;
  pueScore: number;
  networkBackplaneTbps: number;
  clusterStatus: ExaflopClusterStatus;
  datacenterLocation: DatacenterLocation;
  updatedAt: string;
  createdAt: string;
}

export type PlanetaryBatchStatus =
  | 'QUEUED'
  | 'SCHEDULED'
  | 'STREAMING'
  | 'COMPLETED'
  | 'FAILED';

export interface PlanetaryWorkloadBatch {
  id: string;
  batchUuid: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  allocatedClustersCount: number;
  totalComputeExaflopsConsumed: number;
  dispatchLatencyMs: number;
  batchStatus: PlanetaryBatchStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export type ConstellationOrbit =
  | 'LEO_SUN_SYNCHRONOUS'
  | 'MEO_EQUATORIAL'
  | 'GEO_STATIONARY'
  | 'EARTH_MOON_L2';

export type OrbitalRelayHealth =
  | 'ALIGNED'
  | 'ACQUIRING_LOCK'
  | 'ECLIPSE_BATTERY_MODE'
  | 'MAINTENANCE';

export interface OrbitalRelayNode {
  id: string;
  satelliteDesignation: string;
  constellationOrbit: ConstellationOrbit;
  laserLinkCapacityGbps: number;
  relativisticDelayCompensationMs: number;
  bufferStorageTb: number;
  dopplerShiftHz: number;
  nodeHealthStatus: OrbitalRelayHealth;
  lastLaserHandshakeAt: string;
  createdAt: string;
}

export interface EightNinesSlaRecord {
  id: string;
  periodIdentifier: string;
  totalTargetSeconds: number;
  recordedDowntimeMs: number;
  availabilityPercentage: number;
  slaBreached: boolean;
  byzantineQuorumSignatures: number;
  auditMerkleRoot: string;
  verifiedAt: string;
  createdAt: string;
}

export interface PlanetaryDispatchPlan {
  planId: string;
  totalWorkloads: number;
  clusterAllocations: {
    clusterRef: string;
    allocatedWorkloads: number;
    estimatedDurationMs: number;
    allocatedFlopsExa: number;
  }[];
  projectedDispatchLatencyMs: number;
  coolingCapacityMarginPct: number;
}

export interface OpticalTransmissionRequest {
  payloadSizeBytes: number;
  originNode: string;
  destinationNode: string;
  distanceKm: number;
  relativeVelocityMPerS: number;
  baseCarrierFrequencyHz: number;
}

export interface OpticalTransmissionResult {
  transmissionId: string;
  rawPropagationDelayMs: number;
  relativisticDelayCompensationMs: number;
  effectiveTransmissionDurationMs: number;
  dopplerShiftHz: number;
  isLinkViable: boolean;
  requiredBufferStorageTb: number;
}

export { GATE_13_SCALE_TARGETS } from '@/seed/types/galactic-reserve';
