/**
 * @file zero-point-vacuum-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 23: Zero-Point Quantum Vacuum Super-Lattice & Eighteen-Nines Continuous SLA Guarantee.
 */

export const EIGHTEEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 0.002592, // (1 - 0.999999999999999999) * 2,592,000,000,000,000 = 0.002592 ns (0.000002592 µs)
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.000002592,
  MAX_VACUUM_BUS_LATENCY_NS: 0.05, // Sub-0.05 ns bus latency
  MIN_VACUUM_NODES: 4_194_304,
  MIN_BOSE_EINSTEIN_COP: 35.0, // Coefficient of performance >= 35.0
  MAX_RELATIVISTIC_CLOCK_DRIFT_FS: 0.5, // Sub-0.5 femtosecond clock drift
} as const;

export type ZeroPointSector =
  | 'TRANS_COSMIC_CORE'
  | 'OMNIPRESENT_SINGULARITY_WELL'
  | 'ZERO_POINT_CHAMBER'
  | 'VIRGO_SUPER_SPUR'
  | 'COSMOLOGICAL_HORIZON';

export type SuperLatticeStatus =
  | 'VACUUM_PUMPING_ACTIVE'
  | 'ZERO_POINT_FLUX_STABLE'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface ZeroPointSuperLattice {
  id?: string;
  latticeRef: string;
  locationSector: ZeroPointSector;
  datacenterLocation?: string;
  vacuumNodesCount: number;
  vacuumBusLatencyNanos: number;
  vacuumBusBandwidthPetabytes: number;
  relativisticClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  superLatticeStatus: SuperLatticeStatus;
  latticeSignature: string;
  createdAt?: string;
}

export type ZeroPointPowerSource =
  | 'ZERO_POINT_VACUUM_HARVESTER'
  | 'MULTIVERSE_CONTINUUM_TAP'
  | 'TACHYON_ZERO_WELL';

export interface ZeroPointPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: ZeroPointPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 35.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type TransCosmicDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface TransCosmicPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  latticeRef: string;
  pipelineJobCount: number; // 400,000,000 jobs
  dataVolumePetabytes: number; // 1,000,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: TransCosmicDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface EighteenNinesSLAAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number; // <= 0.002592 ns
  achievedAvailabilityPct: number; // 99.9999999999999999
  isEighteenNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
