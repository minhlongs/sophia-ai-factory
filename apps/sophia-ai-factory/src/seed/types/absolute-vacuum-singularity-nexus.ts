/**
 * @file absolute-vacuum-singularity-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 24: Absolute Vacuum Singularity Mesh & Nineteen-Nines Continuous SLA Guarantee.
 */

export const NINETEEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 0.0002592, // (1 - 0.9999999999999999999) * 2,592,000,000,000,000 = 0.0002592 ns
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.0000002592,
  MAX_VACUUM_BUS_LATENCY_NS: 0.02, // Sub-0.02 ns bus latency (target 0.01 ns)
  MIN_VACUUM_NODES: 8_388_608,
  MIN_BOSE_EINSTEIN_COP: 40.0, // Coefficient of performance >= 40.0
  MAX_RELATIVISTIC_CLOCK_DRIFT_FS: 0.2, // Sub-0.2 femtosecond clock drift (target 0.15 fs)
} as const;

export type AbsoluteVacuumSector =
  | 'PAN_GALACTIC_CORE'
  | 'OMNIPRESENT_SINGULARITY_WELL'
  | 'ZERO_POINT_CHAMBER'
  | 'VIRGO_SUPER_SPUR'
  | 'COSMOLOGICAL_HORIZON';

export type AbsoluteVacuumMeshStatus =
  | 'VACUUM_PUMPING_ACTIVE'
  | 'SINGULARITY_VACUUM_OPTIMAL'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface AbsoluteVacuumSingularityMesh {
  id?: string;
  meshRef: string;
  locationSector: AbsoluteVacuumSector;
  datacenterLocation?: string;
  vacuumNodesCount: number;
  vacuumBusLatencyNanos: number;
  vacuumBusBandwidthPetabytes: number;
  relativisticClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  meshStatus: AbsoluteVacuumMeshStatus;
  meshSignature: string;
  createdAt?: string;
}

export type AbsoluteVacuumPowerSource =
  | 'ABSOLUTE_ZERO_POINT_HARVESTER'
  | 'MULTIVERSE_CONTINUUM_TAP'
  | 'TACHYON_ZERO_WELL';

export interface SingularityPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: AbsoluteVacuumPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 40.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type PanGalacticDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface PanGalacticPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  meshRef: string;
  pipelineJobCount: number; // 800,000,000 jobs
  dataVolumePetabytes: number; // 2,000,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: PanGalacticDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface NineteenNinesSLAAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number; // <= 0.0002592 ns
  achievedAvailabilityPct: number; // 99.99999999999999999
  isNineteenNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
