/**
 * @file transcendental-vacuum-singularity-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 25: Transcendental Quantum Vacuum Singularity Mesh & Twenty-Nines Continuous SLA Guarantee.
 */

export const TWENTY_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 0.00002592, // (1 - 0.99999999999999999999) * 2,592,000,000,000,000 = 0.00002592 ns
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.00000002592,
  MAX_VACUUM_BUS_LATENCY_NS: 0.01, // Sub-0.01 ns bus latency (target 0.005 ns)
  MIN_VACUUM_NODES: 16_777_216,
  MIN_BOSE_EINSTEIN_COP: 45.0, // Coefficient of performance >= 45.0
  MAX_RELATIVISTIC_CLOCK_DRIFT_FS: 0.1, // Sub-0.1 femtosecond clock drift (target 0.08 fs)
} as const;

export type TranscendentalSector =
  | 'OMNIVERSE_CORE'
  | 'TRANSCENDENTAL_SINGULARITY_WELL'
  | 'ZERO_POINT_CHAMBER'
  | 'VIRGO_SUPER_SPUR'
  | 'COSMOLOGICAL_HORIZON';

export type TranscendentalMeshStatus =
  | 'VACUUM_PUMPING_ACTIVE'
  | 'TRANSCENDENTAL_VACUUM_OPTIMAL'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface TranscendentalVacuumSingularityMesh {
  id?: string;
  meshRef: string;
  locationSector: TranscendentalSector;
  datacenterLocation?: string;
  vacuumNodesCount: number;
  vacuumBusLatencyNanos: number;
  vacuumBusBandwidthPetabytes: number;
  relativisticClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  meshStatus: TranscendentalMeshStatus;
  meshSignature: string;
  createdAt?: string;
}

export type TranscendentalPowerSource =
  | 'TRANSCENDENTAL_ZERO_POINT_HARVESTER'
  | 'MULTIVERSE_CONTINUUM_TAP'
  | 'TACHYON_ZERO_WELL';

export interface TranscendentalPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: TranscendentalPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 45.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type OmniverseDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface OmniversePipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  meshRef: string;
  pipelineJobCount: number; // 2,000,000,000 jobs
  dataVolumePetabytes: number; // 5,000,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: OmniverseDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface TwentyNinesSLAAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number; // <= 0.00002592 ns
  achievedAvailabilityPct: number; // 99.999999999999999999
  isTwentyNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
