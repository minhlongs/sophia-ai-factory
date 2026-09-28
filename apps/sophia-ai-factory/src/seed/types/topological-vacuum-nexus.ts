/**
 * @file topological-vacuum-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 19: Topological Vacuum Matrix & Fourteen-Nines Continuous SLA Guarantee.
 */

export const FOURTEEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 25.92, // (1 - 0.99999999999999) * 2,592,000,000,000,000 = 25.92 ns (0.02592 µs)
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.02592,
  MAX_WAVEGUIDE_LATENCY_NS: 1.2, // Sub-1.2 ns bus latency
  MIN_TOPOLOGICAL_VACUUM_NODES: 262_144,
  MIN_BOSE_EINSTEIN_COP: 16.0, // Coefficient of performance >= 16.0
  MAX_PLANCK_CLOCK_DRIFT_FS: 25.0, // Sub-25 femtoseconds clock drift
} as const;

export type MultiverseLatticeSector =
  | 'PRIME_COSMIC_CORE'
  | 'DIMENSION_THETA_WELL'
  | 'PLANCK_VACUUM_CHAMBER'
  | 'ANDROMEDA_TACHYON_SPUR'
  | 'VIRGO_GRAVITON_SINK';

export type TopologicalLatticeStatus =
  | 'VACUUM_PUMPING_ACTIVE'
  | 'ANYONIC_FLUX_STABLE'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface TopologicalVacuumComputeLattice {
  id?: string;
  latticeRef: string;
  locationSector: MultiverseLatticeSector;
  datacenterLocation?: string;
  topologicalVacuumNodesCount: number;
  waveguideLatencyNanos: number;
  vacuumBusBandwidthPetabytes: number;
  planckClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  topologicalStatus: TopologicalLatticeStatus;
  latticeSignature: string;
  createdAt?: string;
}

export type ZeroPointPowerSource =
  | 'ZERO_POINT_VACUUM_CORE'
  | 'COSMIC_STRING_HARVESTER'
  | 'HAWKING_RADIATION_TAP';

export interface ZeroPointPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: ZeroPointPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 16.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type VacuumDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface VacuumPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  latticeRef: string;
  pipelineJobCount: number; // 20,000,000
  dataVolumePetabytes: number; // 50,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: VacuumDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface FourteenNinesSlaAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number; // 2,592,000 s
  downtimeNanoseconds: number; // <= 25.92 ns
  achievedAvailabilityPct: number;
  isFourteenNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
