/**
 * @file inter-galactic-quantum-mesh-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 28: Omni-Cosmic Sub-Planck Foam Singularity Mesh & Thirty-Six-Nines Continuous SLA Guarantee.
 */

export const THIRTY_SIX_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 0.00000000000002592, // Thirty-six-nines SLA downtime budget
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.00000000000000002592,
  MAX_QUANTUM_BUS_LATENCY_NS: 0.0002, // Sub-0.0002 ns bus latency (target 0.0001 ns)
  MIN_SUB_PLANCK_FOAM_NODES: 134_217_728, // 2^27 nodes
  MIN_BOSE_EINSTEIN_COP: 75.0, // Coefficient of performance >= 75.0
  MAX_RELATIVISTIC_CLOCK_DRIFT_FS: 0.01, // Sub-0.01 femtosecond clock drift (target 0.005 fs)
} as const;

export type InterGalacticSector =
  | 'INTER_GALACTIC_CORE'
  | 'OMNI_COSMIC_HUB'
  | 'SUB_PLANCK_FOAM_CHAMBER'
  | 'VIRGO_SUPERCLUSTER_APEX'
  | 'ETERNAL_HORIZON';

export type InterGalacticMeshStatus =
  | 'QUANTUM_PUMPING_ACTIVE'
  | 'OMNI_COSMIC_SUB_PLANCK_OPTIMAL'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_THERMAL_DECAY';

export interface InterGalacticQuantumSingularityMesh {
  id?: string;
  meshRef: string;
  locationSector: InterGalacticSector;
  subPlanckFoamNodesCount: number;
  quantumBusLatencyNanos: number;
  quantumBusBandwidthPetabytes: number;
  relativisticClockDriftFs: number;
  activeSentientPipelinesCount: number;
  thermalCopRatio: number;
  meshStatus: InterGalacticMeshStatus;
  meshSignature: string;
  createdAt?: string;
}

export type InterGalacticPowerSource =
  | 'OMNI_COSMIC_ZERO_POINT_HARVESTER'
  | 'INTER_GALACTIC_CONTINUUM_TAP'
  | 'SUB_PLANCK_ZERO_WELL';

export interface InterGalacticPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: InterGalacticPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  boseEinsteinCop: number; // >= 75.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type InterGalacticDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_WAVEGUIDE'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_THERMAL_QUENCH';

export interface InterGalacticPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  meshRef: string;
  pipelineJobCount: number; // 20,000,000,000
  dataVolumePetabytes: number; // 50,000,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: InterGalacticDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface ThirtySixNinesSlaAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number;
  downtimeNanoseconds: number;
  achievedAvailabilityPct: number;
  isThirtySixNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
