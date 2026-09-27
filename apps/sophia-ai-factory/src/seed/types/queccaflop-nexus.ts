/**
 * @file queccaflop-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 16: QueccaFLOP Photonic-Quantum Compute Nexus & Eleven-Nines SLA.
 */

export const ELEVEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000, // 30 days
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 25, // Math.round((1 - 0.99999999999) * 2592000000000) = 25.92 µs
  MAX_OPTICAL_LATENCY_NS: 15.0,
  MIN_COHERENT_QUBITS: 131_072,
  MIN_CRYO_COP: 8.0,
  MAX_FEMTOSECOND_DRIFT_FS: 500.0, // max 500 femtoseconds clock drift
} as const;

export type QueccaLocationSector =
  | 'STELLAR_DYSON_SWARM'
  | 'ORBITAL_RING_SYNAPSE'
  | 'LUNAR_CRYOGENIC_DEEP'
  | 'LAGRANGE_SUPERCLUSTER'
  | 'MARS_HELLAS_BASIN';

export type QueccaGridStatus =
  | 'ONLINE_SUPERCONDUCTING'
  | 'DEGRADED_COHERENCE'
  | 'MAINTENANCE_PURGE'
  | 'MAINTENANCE_CRYO_CYCLE';

export interface QueccaflopComputeGrid {
  id?: string;
  gridNodeId: string;
  locationSector?: QueccaLocationSector;
  datacenterLocation?: string;
  peakQueccaflops: number;
  opticalBackplaneLatencyNs: number;
  coherentQubitCount: number;
  activePhotonicCores?: number;
  gridAvailabilityScore: number;
  thermalCopRatio: number;
  femtosecondClockDriftFs?: number;
  status: QueccaGridStatus;
  createdAt?: string;
}

export type KardashevGenerationSource =
  | 'KARDASHEV_STELLAR_HARVESTER'
  | 'QUANTUM_VACUUM_GENERATOR'
  | 'DIRECT_PLASMA_TAP';

export interface KardashevPowerAllocation {
  id: string;
  allocationRef: string;
  generationSource: KardashevGenerationSource;
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number; // strictly 0.0
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
  isPureNetZero: boolean;
  verifiedAt: string;
  createdAt: string;
}

export type QueccaDispatchState =
  | 'BUFFERED'
  | 'OPTICAL_BEAM_ACTIVE'
  | 'RENDERED_SYNTHESIZED'
  | 'FAILED_PHASE_SLIP';

export interface QueccaPipelineDispatch {
  id: string;
  batchRef: string;
  targetGridId: string;
  concurrentJobCount: number; // 2,000,000 jobs
  totalOpticalPetabytes: number;
  femtosecondClockDriftFs: number;
  dispatchState: QueccaDispatchState;
  completedAt?: string;
  createdAt: string;
}

export type ElevenNinesSlaVerdict =
  | 'ELEVEN_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED'
  | 'UNDER_AUDIT';

export interface ElevenNinesSlaAudit {
  id: string;
  auditWindow: string;
  totalWindowMicroseconds: number;
  actualDowntimeMicroseconds: number;
  effectiveAvailabilityPct: number;
  quantumEntangledRedundancyActive: boolean;
  bftQuorumConsensusPct: number;
  slaVerdict: ElevenNinesSlaVerdict;
  auditSignature: string;
  certifiedAt: string;
  createdAt: string;
}
