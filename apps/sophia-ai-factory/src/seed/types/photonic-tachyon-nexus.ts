/**
 * @file photonic-tachyon-nexus.ts
 * @layer seed/types
 * @description Seed types for Gate 17: Ronan-Quecca Photonic-Tachyon Compute Matrix & Twelve-Nines SLA.
 */

export const TWELVE_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000, // 30 days = 2.592T µs
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 2.592, // (1 - 0.999999999999) * 2,592,000,000,000 = 2.592 µs
  MAX_OPTICAL_LATENCY_NS: 10.0, // Sub-10 ns backplane
  MIN_COHERENT_QUBITS: 262_144,
  MIN_CRYO_COP: 9.0, // Coefficient of performance >= 9.0
  MAX_TACHYON_DRIFT_FS: 250.0, // Max 250 femtoseconds clock drift
} as const;

export type TachyonLocationSector =
  | 'DYSON_SWARM_HELIOS'
  | 'ALPHA_CENTAURI_SYNAPSE'
  | 'LUNAR_CRYO_DEEP'
  | 'OORT_CLOUD_RELAY'
  | 'MARS_OLYMPUS_MONS';

export type TachyonMatrixStatus =
  | 'ONLINE_SUPERCONDUCTING'
  | 'DEGRADED_COHERENCE'
  | 'MAINTENANCE_CRYOPURGE';

export interface PhotonicTachyonComputeMatrix {
  id?: string;
  matrixNodeId: string;
  locationSector: TachyonLocationSector;
  datacenterLocation?: string;
  peakQueccaflops: number;
  opticalBackplaneLatencyNs: number;
  coherentQubitCount: number;
  activePhotonicCores?: number;
  matrixAvailabilityScore: number;
  thermalCopRatio: number;
  tachyonClockDriftFs: number;
  status: TachyonMatrixStatus;
  createdAt?: string;
}

export type DysonGenerationSource =
  | 'DYSON_SWARM_COLLECTOR'
  | 'TACHYON_VACUUM_TAP'
  | 'ZERO_POINT_EXTRACTOR';

export interface DysonSwarmPowerAllocation {
  id?: string;
  allocationRef: string;
  generationSource: DysonGenerationSource;
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number; // Strictly 0.0
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
  isPureNetZero: boolean;
  verifiedAt: string;
  createdAt?: string;
}

export type TachyonDispatchState =
  | 'BUFFERED'
  | 'DISPATCHING'
  | 'COMPLETED_SUPERCONDUCTING'
  | 'ABORTED_COHERENCE_BREACH';

export interface TachyonPipelineDispatch {
  id?: string;
  dispatchRef: string;
  targetMatrixId: string;
  assignedWorkloadCount: number; // 4,000,000 workloads
  opticalDataPetabytes: number; // 8,000 Petabytes
  tachyonDriftFs: number;
  dispatchState: TachyonDispatchState;
  dispatchHash: string;
  dispatchedAt: string;
  createdAt?: string;
}

export type TwelveNinesSlaVerdict =
  | 'TWELVE_NINES_CERTIFIED'
  | 'BREACH_LIQUIDITY_PENALIZED';

export interface TwelveNinesSlaAudit {
  id?: string;
  auditRef: string;
  totalWindowMicroseconds: number;
  actualDowntimeMicroseconds: number;
  effectiveAvailabilityPct: number;
  tachyonEntanglementActive: boolean;
  bftQuorumConsensusPct: number;
  slaVerdict: TwelveNinesSlaVerdict;
  auditSignature: string;
  auditedAt: string;
  createdAt?: string;
}
