/**
 * @file quantum-superconducting-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 18: Quantum Superconducting Matrix & Thirteen-Nines Continuous SLA Guarantee.
 */

export const THIRTEEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_NANOSECONDS: 2_592_000_000_000_000, // 30 days in ns
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000,
  MAX_ALLOWED_DOWNTIME_NANOSECONDS: 259.2, // (1 - 0.9999999999999) * 2,592,000,000,000,000 = 259.2 ns (0.2592 µs)
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 0.2592,
  MAX_OPTICAL_BUS_LATENCY_NS: 3.5, // Sub-3.5 ns bus latency
  MIN_SUPERCONDUCTING_NODES: 65_536,
  MIN_HELIUM_CRYO_COP: 12.0, // Coefficient of performance >= 12.0
  MAX_QUANTUM_CLOCK_DRIFT_FS: 75.0, // Sub-75 femtoseconds clock drift
} as const;

export type QuantumMatrixSector =
  | 'MATRIOSHKA_BRAIN_SOL'
  | 'ANDROMEDA_CORE_ARRAY'
  | 'TRIANGULUM_CRYO_CLUSTER'
  | 'VIRGO_GRAVITATIONAL_WELL'
  | 'DEEP_VOID_SUPERCONDUCTING';

export type QuantumSuperconductingStatus =
  | 'COOLING_ACTIVE'
  | 'CRITICAL_FLUX_STABLE'
  | 'WORKLOAD_SATURATED'
  | 'DEGRADED_QUENCH';

export interface QuantumSuperconductingMatrix {
  id?: string;
  matrixRef: string;
  locationSector: QuantumMatrixSector;
  datacenterLocation?: string;
  superconductingNodeCount: number;
  opticalBusLatencyNanos: number;
  opticalBusBandwidthPetabytes: number;
  clockDriftFemtoseconds: number;
  activeCognitivePipelinesCount: number;
  thermalCopRatio: number;
  superconductingStatus: QuantumSuperconductingStatus;
  matrixSignature: string;
  createdAt?: string;
}

export type MatrioshkaPowerSource =
  | 'MATRIOSHKA_BRAIN_CORE'
  | 'GALACTIC_DYSON_SPHERE'
  | 'QUANTUM_ZERO_POINT_RESONATOR';

export interface MatrioshkaBrainPowerAllocation {
  id?: string;
  allocationRef: string;
  powerSourceType: MatrioshkaPowerSource;
  megawattsAllocated: number;
  carbonIntensityGPerKwh: number; // Strictly 0.0
  heliumCryoCop: number; // >= 12.0
  isNetZeroCertified: boolean;
  allocatedAt?: string;
  createdAt?: string;
}

export type QuantumDispatchStatus =
  | 'SCHEDULED'
  | 'TRANSMITTING_BUS'
  | 'COMPLETED_SYNCHRONOUS'
  | 'FAILED_QUENCH';

export interface QuantumPipelineDispatch {
  id?: string;
  dispatchRef: string;
  sessionToken: string;
  matrixRef: string;
  pipelineJobCount: number; // 10,000,000
  dataVolumePetabytes: number; // 20,000 PB
  dispatchLatencyNanos: number;
  driftCompensationFs: number;
  dispatchStatus: QuantumDispatchStatus;
  dispatchedAt?: string;
  createdAt?: string;
}

export interface ThirteenNinesSlaAudit {
  id?: string;
  auditRef: string;
  evaluationPeriodMonth: string;
  totalEvalSeconds: number; // 2,592,000 s
  downtimeNanoseconds: number; // <= 259.2 ns
  achievedAvailabilityPct: number;
  isThirteenNinesMet: boolean;
  bftConsensusNodes: number;
  auditorHash: string;
  auditedAt: string;
  createdAt?: string;
}
