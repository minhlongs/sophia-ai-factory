/**
 * @file femtosecond-vacuum-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for Femtosecond Vacuum Matrix & 40,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import {
  FIFTEEN_NINES_SLA_CONSTANTS,
  type FemtosecondVacuumComputeMatrix,
} from '@/seed/types/femtosecond-vacuum-nexus';

export interface FemtosecondDispatchPlan {
  targetMatrixRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  planckDriftFs: number;
  dispatchHash: string;
}

/**
 * Calculates multi-dimensional scheduling fitness score for a Femtosecond Vacuum compute matrix.
 */
export function calculateFemtosecondMatrixFitness(
  matrix: FemtosecondVacuumComputeMatrix
): number {
  if (matrix.vacuumMatrixStatus !== 'ANYONIC_FLUX_STABLE') {
    return 0.0;
  }

  const latencyFactor = Math.max(
    0,
    1 - matrix.waveguideLatencyNanos / FIFTEEN_NINES_SLA_CONSTANTS.MAX_WAVEGUIDE_LATENCY_NS
  );

  const nodeFactor = Math.min(
    1.0,
    matrix.femtosecondVacuumNodesCount / FIFTEEN_NINES_SLA_CONSTANTS.MIN_FEMTOSECOND_VACUUM_NODES
  );

  const copFactor = Math.min(
    1.0,
    matrix.thermalCopRatio / FIFTEEN_NINES_SLA_CONSTANTS.MIN_BOSE_EINSTEIN_COP
  );

  const bandwidthFactor = Math.min(
    1.0,
    matrix.vacuumBusBandwidthPetabytes / 100_000
  );

  const compositeScore =
    latencyFactor * 0.35 +
    nodeFactor * 0.25 +
    copFactor * 0.2 +
    bandwidthFactor * 0.2;

  return Number(compositeScore.toFixed(4));
}

/**
 * Plans dispatch of 40,000,000 concurrent sentient cognitive pipelines to optimal Femtosecond Vacuum matrix.
 */
export function planFemtosecondBatchDispatch(
  matrices: FemtosecondVacuumComputeMatrix[],
  workloads: number = 40_000_000,
  measuredDriftFs: number = 8.0
): FemtosecondDispatchPlan {
  const stableMatrices = matrices.filter((m) => m.vacuumMatrixStatus === 'ANYONIC_FLUX_STABLE');

  if (stableMatrices.length === 0) {
    throw new Error('Zero stable femtosecond vacuum matrices available for dispatch');
  }

  if (measuredDriftFs > FIFTEEN_NINES_SLA_CONSTANTS.MAX_PLANCK_CLOCK_DRIFT_FS) {
    throw new Error(
      `Planck relativistic clock drift ${measuredDriftFs} fs exceeds allowable threshold ${FIFTEEN_NINES_SLA_CONSTANTS.MAX_PLANCK_CLOCK_DRIFT_FS} fs`
    );
  }

  let bestMatrix = stableMatrices[0];
  let highestScore = calculateFemtosecondMatrixFitness(bestMatrix);

  for (let i = 1; i < stableMatrices.length; i++) {
    const score = calculateFemtosecondMatrixFitness(stableMatrices[i]);
    if (score > highestScore) {
      highestScore = score;
      bestMatrix = stableMatrices[i];
    }
  }

  // 1 workload = ~0.0025 Petabytes -> 40,000,000 * 0.0025 = 100,000 Petabytes
  const totalBandwidthPetabytes = Number(((workloads * 2.5) / 1000).toFixed(2));

  const dispatchHash = createHash('sha256')
    .update(
      `FEMTOSECOND_DISPATCH:${bestMatrix.matrixRef}:${workloads}:${totalBandwidthPetabytes}:${measuredDriftFs}`
    )
    .digest('hex');

  return {
    targetMatrixRef: bestMatrix.matrixRef,
    assignedWorkloads: workloads,
    totalBandwidthPetabytes,
    planckDriftFs: measuredDriftFs,
    dispatchHash,
  };
}
