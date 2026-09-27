/**
 * @file photonic-tachyon-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for Photonic-Tachyon Compute Matrix & 4,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import {
  TWELVE_NINES_SLA_CONSTANTS,
  type PhotonicTachyonComputeMatrix,
} from '@/seed/types/photonic-tachyon-nexus';

export interface TachyonDispatchPlan {
  targetMatrixId: string;
  assignedWorkloads: number;
  totalOpticalPetabytes: number;
  tachyonDriftFs: number;
  dispatchHash: string;
}

/**
 * Calculates multi-dimensional scheduling fitness score for a Photonic-Tachyon compute matrix.
 */
export function calculatePhotonicMatrixFitness(
  matrix: PhotonicTachyonComputeMatrix
): number {
  if (matrix.status !== 'ONLINE_SUPERCONDUCTING') {
    return 0.0;
  }

  const latencyFactor = Math.max(
    0,
    1 - matrix.opticalBackplaneLatencyNs / TWELVE_NINES_SLA_CONSTANTS.MAX_OPTICAL_LATENCY_NS
  );

  const qubitFactor = Math.min(
    1.0,
    matrix.coherentQubitCount / TWELVE_NINES_SLA_CONSTANTS.MIN_COHERENT_QUBITS
  );

  const copFactor = Math.min(
    1.0,
    matrix.thermalCopRatio / TWELVE_NINES_SLA_CONSTANTS.MIN_CRYO_COP
  );

  const compositeScore =
    matrix.peakQueccaflops * 0.4 +
    latencyFactor * 0.25 +
    qubitFactor * 0.15 +
    copFactor * 0.1 +
    matrix.matrixAvailabilityScore * 0.1;

  return Number(compositeScore.toFixed(4));
}

/**
 * Plans dispatch of 4,000,000 concurrent generative video/AI jobs to optimal Photonic-Tachyon matrix.
 */
export function planTachyonBatchDispatch(
  matrices: PhotonicTachyonComputeMatrix[],
  workloads: number = 4_000_000,
  measuredDriftFs: number = 140.0
): TachyonDispatchPlan {
  const onlineMatrices = matrices.filter((m) => m.status === 'ONLINE_SUPERCONDUCTING');

  if (onlineMatrices.length === 0) {
    throw new Error('Zero online superconducting Photonic-Tachyon matrices available for dispatch');
  }

  if (measuredDriftFs > TWELVE_NINES_SLA_CONSTANTS.MAX_TACHYON_DRIFT_FS) {
    throw new Error(
      `Tachyon relativistic clock drift ${measuredDriftFs} fs exceeds allowable threshold ${TWELVE_NINES_SLA_CONSTANTS.MAX_TACHYON_DRIFT_FS} fs`
    );
  }

  let bestMatrix = onlineMatrices[0];
  let highestScore = calculatePhotonicMatrixFitness(bestMatrix);

  for (let i = 1; i < onlineMatrices.length; i++) {
    const score = calculatePhotonicMatrixFitness(onlineMatrices[i]);
    if (score > highestScore) {
      highestScore = score;
      bestMatrix = onlineMatrices[i];
    }
  }

  // 1 workload = ~0.002 Petabytes -> 4,000,000 * 0.002 = 8,000 Petabytes
  const totalOpticalPetabytes = Number(((workloads * 2) / 1000).toFixed(2));

  const dispatchHash = createHash('sha256')
    .update(
      `TACHYON_DISPATCH:${bestMatrix.matrixNodeId}:${workloads}:${totalOpticalPetabytes}:${measuredDriftFs}`
    )
    .digest('hex');

  return {
    targetMatrixId: bestMatrix.matrixNodeId,
    assignedWorkloads: workloads,
    totalOpticalPetabytes,
    tachyonDriftFs: measuredDriftFs,
    dispatchHash,
  };
}
