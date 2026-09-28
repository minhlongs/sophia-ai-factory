/**
 * @file planck-quantum-foam-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 21: Planck-Scale Quantum Foam Super-Lattice & Sixteen-Nines Continuous SLA Guarantee.
 */

export const SIXTEEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 0.2592, // (1 - 0.9999999999999999) * 2,592,000,000,000,000 = 0.2592 ns (0.0002592 µs)
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.0002592,
  MAX_WAVEGUIDE_LATENCY_NS: 0.5, // Sub-0.5 ns bus latency
  MIN_PLANCK_VACUUM_NODES: 1_048_576,
  MIN_BOSE_EINSTEIN_COP: 25.0, // Coefficient of performance >= 25.0
  MAX_PLANCK_CLOCK_DRIFT_FS: 5.0, // Sub-5 femtoseconds clock drift
} as const;

export type ContinuumSector =
  | 'OMEGA_POINT_CORE'
  | 'DIMENSION_INFINITY_WELL'
  | 'PLANCK_FOAM_CHAMBER'
  | 'VIRGO_MEGA_SPUR'
  | 'CONTINUUM_SINK';

export type FoamLatticeStatus =
  | 'VACUUM_PUMPING_ACTIVE'
  | 'ANYONIC_FLUX_STABLE'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface PlanckQuantumFoamLattice {
  id?: string;
  latticeRef: string;
  locationSector: ContinuumSector;
  datacenterLocation?: string;
  planckVacuumNodesCount: number;
  waveguideLatencyNanos: number;
  vacuumBusBandwidthPetabytes: number;
  planckClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  foamLatticeStatus: FoamLatticeStatus;
  latticeSignature: string;
  createdAt?: string;
}

export type QuantumFoamPowerSource =
  | 'ZERO_POINT_FOAM_TAP'
  | 'OMEGA_SINGULARITY_TAP'
  | 'TACHYON_VACUUM_HARVESTER';

export interface QuantumFoamPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: QuantumFoamPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 25.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type ContinuumDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface ContinuumPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  latticeRef: string;
  pipelineJobCount: number; // 100,000,000 concurrent pipelines
  dataVolumePetabytes: number; // 250,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: ContinuumDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface SixteenNinesSlaAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number;
  achievedAvailabilityPct: number;
  isSixteenNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
