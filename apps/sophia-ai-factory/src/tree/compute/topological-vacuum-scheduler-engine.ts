/**
 * @file topological-vacuum-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for Topological Vacuum Matrix & 20,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import {
  FOURTEEN_NINES_SLA_CONSTANTS,
  type TopologicalVacuumComputeLattice,
} from '@/seed/types/topological-vacuum-nexus';

export interface VacuumDispatchPlan {
  targetLatticeRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  planckDriftFs: number;
  dispatchHash: string;
}

/**
 * Calculates multi-dimensional scheduling fitness score for a Topological Vacuum compute lattice.
 */
export function calculateTopologicalLatticeFitness(
  lattice: TopologicalVacuumComputeLattice
): number {
  if (lattice.topologicalStatus !== 'ANYONIC_FLUX_STABLE') {
    return 0.0;
  }

  const latencyFactor = Math.max(
    0,
    1 - lattice.waveguideLatencyNanos / FOURTEEN_NINES_SLA_CONSTANTS.MAX_WAVEGUIDE_LATENCY_NS
  );

  const nodeFactor = Math.min(
    1.0,
    lattice.topologicalVacuumNodesCount / FOURTEEN_NINES_SLA_CONSTANTS.MIN_TOPOLOGICAL_VACUUM_NODES
  );

  const copFactor = Math.min(
    1.0,
    lattice.thermalCopRatio / FOURTEEN_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP
  );

  const bandwidthFactor = Math.min(
    1.0,
    lattice.vacuumBusBandwidthPetabytes / 50000
  );

  const compositeScore =
    latencyFactor * 0.35 +
    nodeFactor * 0.25 +
    copFactor * 0.2 +
    bandwidthFactor * 0.2;

  return Number(compositeScore.toFixed(4));
}

/**
 * Plans dispatch of 20,000,000 concurrent sentient cognitive pipelines to optimal Topological Vacuum lattice.
 */
export function planVacuumBatchDispatch(
  lattices: TopologicalVacuumComputeLattice[],
  workloads: number = 20_000_000,
  measuredDriftFs: number = 18.0
): VacuumDispatchPlan {
  const stableLattices = lattices.filter((l) => l.topologicalStatus === 'ANYONIC_FLUX_STABLE');

  if (stableLattices.length === 0) {
    throw new Error('Zero stable topological vacuum lattices available for dispatch');
  }

  if (measuredDriftFs > FOURTEEN_NINES_SLA_CONSTANTS.MAX_PLANCK_CLOCK_DRIFT_FS) {
    throw new Error(
      `Planck relativistic clock drift ${measuredDriftFs} fs exceeds allowable threshold ${FOURTEEN_NINES_SLA_CONSTANTS.MAX_PLANCK_CLOCK_DRIFT_FS} fs`
    );
  }

  let bestLattice = stableLattices[0];
  let highestScore = calculateTopologicalLatticeFitness(bestLattice);

  for (let i = 1; i < stableLattices.length; i++) {
    const score = calculateTopologicalLatticeFitness(stableLattices[i]);
    if (score > highestScore) {
      highestScore = score;
      bestLattice = stableLattices[i];
    }
  }

  // 1 workload = ~0.0025 Petabytes -> 20,000,000 * 0.0025 = 50,000 Petabytes
  const totalBandwidthPetabytes = Number(((workloads * 2.5) / 1000).toFixed(2));

  const dispatchHash = createHash('sha256')
    .update(
      `VACUUM_DISPATCH:${bestLattice.latticeRef}:${workloads}:${totalBandwidthPetabytes}:${measuredDriftFs}`
    )
    .digest('hex');

  return {
    targetLatticeRef: bestLattice.latticeRef,
    assignedWorkloads: workloads,
    totalBandwidthPetabytes,
    planckDriftFs: measuredDriftFs,
    dispatchHash,
  };
}
