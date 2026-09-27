/**
 * @file ronanflop-optical-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for RonanFLOP Optical-Quantum Grids & 1,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import {
  TEN_NINES_SLA_CONSTANTS,
  type OpticalPipelineDispatch,
  type RonanflopComputeGrid,
} from '@/seed/types/ronanflop-matrix';

export interface OpticalDispatchPlan {
  targetGridId: string;
  assignedWorkloads: number;
  totalOpticalPetabytes: number;
  relativisticDriftPs: number;
  dispatchHash: string;
}

/**
 * Calculates multi-dimensional scheduling fitness score for a RonanFLOP optical compute grid.
 */
export function calculateOpticalGridFitness(grid: RonanflopComputeGrid): number {
  if (grid.status !== 'ONLINE_SUPERCONDUCTING') {
    return 0.0;
  }

  const latencyFactor = Math.max(
    0,
    1 - grid.opticalBackplaneLatencyNs / TEN_NINES_SLA_CONSTANTS.MAX_OPTICAL_LATENCY_NS
  );

  const qubitFactor = Math.min(
    1.0,
    grid.coherentQubitCount / TEN_NINES_SLA_CONSTANTS.MIN_COHERENT_QUBITS
  );

  const copFactor = Math.min(
    1.0,
    grid.thermalCopRatio / TEN_NINES_SLA_CONSTANTS.MIN_CRYO_COP
  );

  const compositeScore =
    grid.peakRonanflops * 0.4 +
    latencyFactor * 0.25 +
    qubitFactor * 0.15 +
    copFactor * 0.1 +
    grid.gridAvailabilityScore * 0.1;

  return Number(compositeScore.toFixed(4));
}

/**
 * Plans dispatch of 1,000,000 concurrent generative pipeline jobs to the optimal optical grid.
 */
export function planOpticalBatchDispatch(
  grids: RonanflopComputeGrid[],
  workloads: number = 1_000_000,
  measuredDriftPs: number = 0.12
): OpticalDispatchPlan {
  const onlineGrids = grids.filter((g) => g.status === 'ONLINE_SUPERCONDUCTING');

  if (onlineGrids.length === 0) {
    throw new Error('Zero online superconducting RonanFLOP grids available for dispatch');
  }

  if (measuredDriftPs > TEN_NINES_SLA_CONSTANTS.MAX_RELATIVISTIC_DOPPLER_PS) {
    throw new Error(
      `Relativistic Doppler clock drift ${measuredDriftPs} ps exceeds allowable threshold ${TEN_NINES_SLA_CONSTANTS.MAX_RELATIVISTIC_DOPPLER_PS} ps`
    );
  }

  let bestGrid = onlineGrids[0];
  let highestScore = calculateOpticalGridFitness(bestGrid);

  for (let i = 1; i < onlineGrids.length; i++) {
    const score = calculateOpticalGridFitness(onlineGrids[i]);
    if (score > highestScore) {
      highestScore = score;
      bestGrid = onlineGrids[i];
    }
  }

  // 1 workload = ~0.002 Petabytes of generative video render stream
  const totalOpticalPetabytes = Number(((workloads * 2) / 1000).toFixed(2));

  const dispatchHash = createHash('sha256')
    .update(`OPTICAL_DISPATCH:${bestGrid.gridNodeId}:${workloads}:${totalOpticalPetabytes}:${measuredDriftPs}`)
    .digest('hex');

  return {
    targetGridId: bestGrid.gridNodeId,
    assignedWorkloads: workloads,
    totalOpticalPetabytes,
    relativisticDriftPs: measuredDriftPs,
    dispatchHash,
  };
}
