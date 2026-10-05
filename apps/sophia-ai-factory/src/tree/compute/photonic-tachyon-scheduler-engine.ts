/**
 * @file photonic-tachyon-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for Photonic-Tachyon Compute Matrix & 4,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import { planParameterizedBatchDispatch } from './sub-planck-scheduler-domain-engine';

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
  const plan = planParameterizedBatchDispatch(matrices, workloads, measuredDriftFs, {
    maxClockDriftFs: TWELVE_NINES_SLA_CONSTANTS.MAX_TACHYON_DRIFT_FS,
    clockDriftErrorMessageFn: (drift, max) => `Tachyon relativistic clock drift ${drift} fs exceeds allowable threshold ${max} fs`,
    stableStatus: 'ONLINE_SUPERCONDUCTING',
    statusGetter: (m) => (m as unknown as Record<string, unknown>).status as string,
    refGetter: (m) => (m as unknown as Record<string, unknown>).matrixNodeId as string,
    fitnessFn: (m) => calculatePhotonicMatrixFitness(m as never),
    bandwidthPerWorkloadPb: 0.002,
    zeroStableMeshesErrorMessage: 'Zero online superconducting Photonic-Tachyon matrices available for dispatch',
    dispatchHashFn: (ctx) =>
      createHash('sha256')
        .update(`TACHYON_DISPATCH:${ctx.targetMeshRef}:${ctx.assignedWorkloads}:${ctx.totalBandwidthPetabytes}:${ctx.measuredDriftFs}`)
        .digest('hex'),
  });

  return plan as unknown as TachyonDispatchPlan;
}
