/**
 * @file femtosecond-vacuum-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 20: Femtosecond Vacuum Matrix & Fifteen-Nines Continuous SLA Guarantee.
 */

export const FIFTEEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 2.592, // (1 - 0.999999999999999) * 2,592,000,000,000,000 = 2.592 ns (0.002592 µs)
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.002592,
  MAX_WAVEGUIDE_LATENCY_NS: 0.8, // Sub-0.8 ns bus latency
  MIN_FEMTOSECOND_VACUUM_NODES: 524_288,
  MIN_BOSE_EINSTEIN_COP: 20.0, // Coefficient of performance >= 20.0
  MAX_PLANCK_CLOCK_DRIFT_FS: 10.0, // Sub-10 femtoseconds clock drift
} as const;

export type PanCosmicMatrixSector =
  | 'PRIME_MULTIVERSE_CORE'
  | 'DIMENSION_OMEGA_WELL'
  | 'FEMTOSECOND_VACUUM_CHAMBER'
  | 'VIRGO_SUPER_SPUR'
  | 'COSMIC_HORIZON_SINK';

export type VacuumMatrixStatus =
  | 'VACUUM_PUMPING_ACTIVE'
  | 'ANYONIC_FLUX_STABLE'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface FemtosecondVacuumComputeMatrix {
  id?: string;
  matrixRef: string;
  locationSector: PanCosmicMatrixSector;
  datacenterLocation?: string;
  femtosecondVacuumNodesCount: number;
  waveguideLatencyNanos: number;
  vacuumBusBandwidthPetabytes: number;
  planckClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  vacuumMatrixStatus: VacuumMatrixStatus;
  matrixSignature: string;
  createdAt?: string;
}

export type ZeroPointFluxSource =
  | 'ZERO_POINT_VACUUM_WELL'
  | 'COSMIC_SINGULARITY_TAP'
  | 'TACHYON_FLUX_COLLECTOR';

export interface ZeroPointFluxAllocation {
  id?: string;
  allocationRef: string;
  fluxSourceType: ZeroPointFluxSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 20.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type PanCosmicDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface PanCosmicPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  matrixRef: string;
  pipelineJobCount: number; // 40,000,000 concurrent pipelines
  dataVolumePetabytes: number; // 100,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: PanCosmicDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface FifteenNinesSlaAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number;
  achievedAvailabilityPct: number;
  isFifteenNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
