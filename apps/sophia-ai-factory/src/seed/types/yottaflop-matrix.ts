/**
 * @file yottaflop-matrix.ts
 * @layer seed/types
 * @description Seed types for Gate 14: YottaFLOP Super-Scale Planetary Quantum Compute Matrix & Nine-Nines SLA.
 */

export type SupercomputingTier =
  | 'YOTTA_HYBRID_QUANTUM'
  | 'PHOTONIC_SUPERLATTICE'
  | 'EXA_CLUSTER_TIER_1'
  | 'ORBITAL_SOLAR_ARRAY';

export type YottaflopGridStatus =
  | 'ONLINE_OPTIMAL'
  | 'ENERGY_CURTAILED'
  | 'QUANTUM_DECOHERENCE_RECOVERY'
  | 'MAINTENANCE';

export type DatacenterBiome =
  | 'ANTARCTIC_SUBGLACIAL'
  | 'SAHARA_SOLAR_BASIN'
  | 'PACIFIC_TRENCH_HYDROTHERMAL'
  | 'LUNAR_CRATER_SHADOW'
  | 'ORBITAL_LAGRANGE_L1';

export interface YottaflopComputeGrid {
  id: string;
  gridIdentifier: string;
  supercomputingTier: SupercomputingTier;
  activeQubitsLogical: number;
  activeGpusCount: number;
  peakYottaflops: number;
  interconnectLatencyNanoseconds: number;
  powerDrawMegawatts: number;
  gridHealthScore: number;
  status: YottaflopGridStatus;
  datacenterBiome: DatacenterBiome;
  updatedAt: string;
  createdAt: string;
}

export type CleanEnergySource =
  | 'DYSON_SOLAR_COLLECTOR_ARRAY'
  | 'COMPACT_FUSION_REACTOR'
  | 'GEOTHERMAL_MANTLE_TAP'
  | 'DEEP_OCEAN_THERMAL';

export interface DysonPowerAllocation {
  id: string;
  allocationId: string;
  energySource: CleanEnergySource;
  allocatedMegawatts: number;
  carbonIntensityGCo2PerKwh: number;
  gridEfficiencyCop: number;
  coolingThermalDeltaCelsius: number;
  timestampRecorded: string;
}

export type QuantumBatchDispatchStatus =
  | 'QUEUED'
  | 'ORCHESTRATING'
  | 'STREAMING'
  | 'COMPLETED'
  | 'FAILED';

export interface QuantumPipelineBatch {
  id: string;
  batchId: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  quantumCircuitsExecuted: number;
  p99LatencyMicroseconds: number;
  dispatchStatus: QuantumBatchDispatchStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface NineNinesSlaAudit {
  id: string;
  periodIdentifier: string;
  targetSeconds: number;
  recordedDowntimeMicroseconds: number;
  availabilityPercentage: number;
  slaBreached: boolean;
  quantumTeleportationSyncValid: boolean;
  byzantineValidatorsCount: number;
  auditProofRoot: string;
  verifiedAt: string;
  createdAt: string;
}

export interface PlanetaryQuantumDispatchPlan {
  planId: string;
  totalWorkloads: number;
  scheduledGridsCount: number;
  allocations: {
    gridIdentifier: string;
    allocatedJobs: number;
    allocatedQubits: number;
    estimatedExecutionMicroseconds: number;
  }[];
  projectedDispatchLatencyMicroseconds: number;
}

export { GATE_14_SCALE_TARGETS } from '@/seed/types/cls-liquidity';
