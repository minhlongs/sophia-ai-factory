/**
 * @file quantum-superconducting-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for Quantum Superconducting Matrix & 10,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import {
  THIRTEEN_NINES_SLA_CONSTANTS,
  type QuantumSuperconductingMatrix,
} from '@/seed/types/quantum-superconducting-nexus';

export interface QuantumDispatchPlan {
  targetMatrixRef: string;
  assignedWorkloads: number;
  totalBandwidthPetabytes: number;
  quantumDriftFs: number;
  dispatchHash: string;
}

/**
 * Calculates multi-dimensional scheduling fitness score for a Quantum Superconducting matrix.
 */
export function calculateQuantumMatrixFitness(
  matrix: QuantumSuperconductingMatrix
): number {
  if (matrix.superconductingStatus !== 'CRITICAL_FLUX_STABLE') {
    return 0.0;
  }

  const latencyFactor = Math.max(
    0,
    1 - matrix.opticalBusLatencyNanos / THIRTEEN_NINES_SLA_CONSTANTS.MAX_OPTICAL_BUS_LATENCY_NS
  );

  const nodeFactor = Math.min(
    1.0,
    matrix.superconductingNodeCount / THIRTEEN_NINES_SLA_CONSTANTS.MIN_SUPERCONDUCTING_NODES
  );

  const copFactor = Math.min(
    1.0,
    matrix.thermalCopRatio / THIRTEEN_NINES_SLA_CONSTANTS.MIN_HELIUM_CRYO_COP
  );

  const bandwidthFactor = Math.min(
    1.0,
    matrix.opticalBusBandwidthPetabytes / 20000
  );

  const compositeScore =
    latencyFactor * 0.35 +
    nodeFactor * 0.25 +
    copFactor * 0.2 +
    bandwidthFactor * 0.2;

  return Number(compositeScore.toFixed(4));
}

/**
 * Plans dispatch of 10,000,000 concurrent cognitive pipelines to optimal Quantum Superconducting matrix.
 */
export function planQuantumBatchDispatch(
  matrices: QuantumSuperconductingMatrix[],
  workloads: number = 10_000_000,
  measuredDriftFs: number = 42.0
): QuantumDispatchPlan {
  const stableMatrices = matrices.filter((m) => m.superconductingStatus === 'CRITICAL_FLUX_STABLE');

  if (stableMatrices.length === 0) {
    throw new Error('Zero stable superconducting Quantum matrices available for dispatch');
  }

  if (measuredDriftFs > THIRTEEN_NINES_SLA_CONSTANTS.MAX_QUANTUM_CLOCK_DRIFT_FS) {
    throw new Error(
      `Quantum relativistic clock drift ${measuredDriftFs} fs exceeds allowable threshold ${THIRTEEN_NINES_SLA_CONSTANTS.MAX_QUANTUM_CLOCK_DRIFT_FS} fs`
    );
  }

  let bestMatrix = stableMatrices[0];
  let highestScore = calculateQuantumMatrixFitness(bestMatrix);

  for (let i = 1; i < stableMatrices.length; i++) {
    const score = calculateQuantumMatrixFitness(stableMatrices[i]);
    if (score > highestScore) {
      highestScore = score;
      bestMatrix = stableMatrices[i];
    }
  }

  // 1 workload = ~0.002 Petabytes -> 10,000,000 * 0.002 = 20,000 Petabytes
  const totalBandwidthPetabytes = Number(((workloads * 2) / 1000).toFixed(2));

  const dispatchHash = createHash('sha256')
    .update(
      `QUANTUM_DISPATCH:${bestMatrix.matrixRef}:${workloads}:${totalBandwidthPetabytes}:${measuredDriftFs}`
    )
    .digest('hex');

  return {
    targetMatrixRef: bestMatrix.matrixRef,
    assignedWorkloads: workloads,
    totalBandwidthPetabytes,
    quantumDriftFs: measuredDriftFs,
    dispatchHash,
  };
}
