/**
 * @file omni-dimensional-quantum-mesh-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 27: Omni-Dimensional Planck-Scale Foam Singularity Mesh & Thirty-Three-Nines Continuous SLA Guarantee.
 */

export const THIRTY_THREE_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 0.000000000002592, // (1 - 0.9999999999999999999999999999999) * 2,592,000,000,000,000
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.000000000000002592,
  MAX_QUANTUM_BUS_LATENCY_NS: 0.0005, // Sub-0.0005 ns bus latency (target 0.0002 ns)
  MIN_PLANCK_FOAM_NODES: 67_108_864, // 2^26 nodes
  MIN_BOSE_EINSTEIN_COP: 60.0, // Coefficient of performance >= 60.0
  MAX_RELATIVISTIC_CLOCK_DRIFT_FS: 0.02, // Sub-0.02 femtosecond clock drift (target 0.01 fs)
} as const;

export type OmniDimensionalSector =
  | 'OMNI_COSMIC_CORE'
  | 'INTER_UNIVERSAL_HUB'
  | 'PLANCK_FOAM_CHAMBER'
  | 'VIRGO_PRIME_SPUR'
  | 'ETERNAL_HORIZON';

export type OmniDimensionalMeshStatus =
  | 'QUANTUM_PUMPING_ACTIVE'
  | 'OMNI_DIMENSIONAL_PLANCK_OPTIMAL'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface OmniDimensionalQuantumSingularityMesh {
  id?: string;
  meshRef: string;
  locationSector: OmniDimensionalSector;
  planckFoamNodesCount: number;
  quantumBusLatencyNanos: number;
  quantumBusBandwidthPetabytes: number;
  relativisticClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  meshStatus: OmniDimensionalMeshStatus;
  meshSignature: string;
  createdAt?: string;
}

export type OmniDimensionalPowerSource =
  | 'OMNI_DIMENSIONAL_ZERO_POINT_HARVESTER'
  | 'INTER_UNIVERSAL_CONTINUUM_TAP'
  | 'PLANCK_ZERO_WELL';

export interface OmniDimensionalPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: OmniDimensionalPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 60.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type OmniDimensionalDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface OmniDimensionalPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  meshRef: string;
  pipelineJobCount: number; // 10,000,000,000
  dataVolumePetabytes: number; // 25,000,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: OmniDimensionalDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface ThirtyThreeNinesSlaAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number;
  achievedAvailabilityPct: number;
  isThirtyThreeNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
