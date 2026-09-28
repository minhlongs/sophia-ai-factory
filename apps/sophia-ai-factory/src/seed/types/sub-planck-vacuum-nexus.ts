/**
 * @file sub-planck-vacuum-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 22: Sub-Planck Quantum Vacuum Foam Lattice & Seventeen-Nines Continuous SLA Guarantee.
 */

export const SEVENTEEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 0.02592, // (1 - 0.99999999999999999) * 2,592,000,000,000,000 = 0.02592 ns (0.00002592 µs)
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.00002592,
  MAX_VACUUM_BUS_LATENCY_NS: 0.1, // Sub-0.1 ns bus latency
  MIN_SUB_PLANCK_VACUUM_NODES: 2_097_152,
  MIN_BOSE_EINSTEIN_COP: 30.0, // Coefficient of performance >= 30.0
  MAX_PLANCK_CLOCK_DRIFT_FS: 1.0, // Sub-1 femtosecond clock drift
} as const;

export type MultiverseSector =
  | 'OMNIPRESENT_CORE'
  | 'MULTIVERSE_SINGULARITY_WELL'
  | 'SUB_PLANCK_CHAMBER'
  | 'VIRGO_HYPER_SPUR'
  | 'COSMOLOGICAL_HORIZON';

export type FoamLatticeStatus =
  | 'VACUUM_PUMPING_ACTIVE'
  | 'ANYONIC_FLUX_STABLE'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface SubPlanckFoamLattice {
  id?: string;
  latticeRef: string;
  locationSector: MultiverseSector;
  datacenterLocation?: string;
  subPlanckVacuumNodesCount: number;
  vacuumBusLatencyNanos: number;
  vacuumBusBandwidthPetabytes: number;
  planckClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  foamLatticeStatus: FoamLatticeStatus;
  latticeSignature: string;
  createdAt?: string;
}

export type SubPlanckPowerSource =
  | 'SUB_PLANCK_ZERO_POINT_HARVESTER'
  | 'MULTIVERSE_CORE_TAP'
  | 'TACHYON_VACUUM_WELL';

export interface SubPlanckPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: SubPlanckPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 30.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type MultiverseDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface MultiversePipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  latticeRef: string;
  pipelineJobCount: number;
  dataVolumePetabytes: number;
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: MultiverseDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface SeventeenNinesSlaAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number;
  achievedAvailabilityPct: number;
  isSeventeenNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
