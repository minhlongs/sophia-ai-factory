/**
 * @file ronanflop-matrix.ts
 * @layer seed/types
 * @description Seed types for Gate 15: RonanFLOP Quantum-Optical Hyperscale Matrix & Ten-Nines SLA.
 */

export const TEN_NINES_SLA_CONSTANTS = {
  TOTAL_MONTHLY_MICROSECONDS: 2_592_000_000_000, // 30 days
  MAX_ALLOWED_DOWNTIME_MICROSECONDS: 259, // Math.round((1 - 0.9999999999) * 2592000000000) = 259.2 µs
  MAX_OPTICAL_LATENCY_NS: 50.0,
  MIN_COHERENT_QUBITS: 65_536,
  MIN_CRYO_COP: 6.5,
  MAX_RELATIVISTIC_DOPPLER_PS: 1.0, // max 1.0 picosecond clock drift
} as const;

export type LocationSector =
  | 'GEO_STATIONARY_ORBIT'
  | 'LUNAR_GATEWAY'
  | 'LAGRANGE_L4'
  | 'POLAR_SUBSEA_RING'
  | 'EQUATORIAL_SUPERCLUSTER';

export type GridStatus = 'ONLINE_SUPERCONDUCTING' | 'DEGRADED_COHERENCE' | 'MAINTENANCE_PURGE';

export interface RonanflopComputeGrid {
  id: string;
  gridNodeId: string;
  locationSector: LocationSector;
  peakRonanflops: number;
  opticalBackplaneLatencyNs: number;
  coherentQubitCount: number;
  gridAvailabilityScore: number;
  thermalCopRatio: number;
  status: GridStatus;
  createdAt: string;
}

export type PowerGenerationSource =
  | 'MATRIOSHKA_DYSON_SWARM'
  | 'STELLAR_FUSION_CORE'
  | 'QUANTUM_VACUUM_HARVESTER';

export interface MatrioshkaPowerAllocation {
  id: string;
  allocationRef: string;
  generationSource: PowerGenerationSource;
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number; // strictly 0.0
  cryoCoolingPowerMw: number;
  coolingEfficiencyCop: number;
  isPureNetZero: boolean;
  verifiedAt: string;
  createdAt: string;
}

export type DispatchState =
  | 'BUFFERED'
  | 'OPTICAL_BEAM_ACTIVE'
  | 'RENDERED_SYNTHESIZED'
  | 'FAILED_PHASE_SLIP';

export interface OpticalPipelineDispatch {
  id: string;
  batchRef: string;
  targetGridId: string;
  concurrentJobCount: number; // 1,000,000 jobs
  totalOpticalPetabytes: number;
  relativisticDopplerDriftPs: number;
  dispatchState: DispatchState;
  completedAt?: string;
  createdAt: string;
}

export type SlaVerdict = 'TEN_NINES_CERTIFIED' | 'BREACH_LIQUIDITY_PENALIZED' | 'UNDER_AUDIT';

export interface TenNinesSlaAudit {
  id: string;
  auditWindow: string;
  totalWindowMicroseconds: number;
  actualDowntimeMicroseconds: number;
  effectiveAvailabilityPct: number;
  quantumTeleportSyncActive: boolean;
  bftQuorumConsensusPct: number;
  slaVerdict: SlaVerdict;
  auditSignature: string;
  certifiedAt: string;
  createdAt: string;
}
