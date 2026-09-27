/**
 * @file queccaflop-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for QueccaFLOP Photonic-Quantum Grids & 2,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import {
  ELEVEN_NINES_SLA_CONSTANTS,
  type QueccaflopComputeGrid,
} from '@/seed/types/queccaflop-nexus';

export interface QueccaDispatchPlan {
  targetGridId: string;
  assignedWorkloads: number;
  totalOpticalPetabytes: number;
  femtosecondDriftFs: number;
  dispatchHash: string;
}

/**
 * Calculates multi-dimensional scheduling fitness score for a QueccaFLOP photonic compute grid.
 */
export function calculateQueccaGridFitness(grid: QueccaflopComputeGrid): number {
  if (grid.status !== 'ONLINE_SUPERCONDUCTING') {
    return 0.0;
  }

  const latencyFactor = Math.max(
    0,
    1 - grid.opticalBackplaneLatencyNs / ELEVEN_NINES_SLA_CONSTANTS.MAX_OPTICAL_LATENCY_NS
  );

  const qubitFactor = Math.min(
    1.0,
    grid.coherentQubitCount / ELEVEN_NINES_SLA_CONSTANTS.MIN_COHERENT_QUBITS
  );

  const copFactor = Math.min(
    1.0,
    grid.thermalCopRatio / ELEVEN_NINES_SLA_CONSTANTS.MIN_CRYO_COP
  );

  const compositeScore =
    grid.peakQueccaflops * 0.4 +
    latencyFactor * 0.25 +
    qubitFactor * 0.15 +
    copFactor * 0.1 +
    grid.gridAvailabilityScore * 0.1;

  return Number(compositeScore.toFixed(4));
}

/**
 * Plans dispatch of 2,000,000 concurrent generative video/AI jobs to optimal QueccaFLOP photonic grid.
 */
export function planQueccaBatchDispatch(
  grids: QueccaflopComputeGrid[],
  workloads: number = 2_000_000,
  measuredDriftFs: number = 120.0
): QueccaDispatchPlan {
  const onlineGrids = grids.filter((g) => g.status === 'ONLINE_SUPERCONDUCTING');

  if (onlineGrids.length === 0) {
    throw new Error('Zero online superconducting QueccaFLOP grids available for dispatch');
  }

  if (measuredDriftFs > ELEVEN_NINES_SLA_CONSTANTS.MAX_FEMTOSECOND_DRIFT_FS) {
    throw new Error(
      `Femtosecond relativistic clock drift ${measuredDriftFs} fs exceeds allowable threshold ${ELEVEN_NINES_SLA_CONSTANTS.MAX_FEMTOSECOND_DRIFT_FS} fs`
    );
  }

  let bestGrid = onlineGrids[0];
  let highestScore = calculateQueccaGridFitness(bestGrid);

  for (let i = 1; i < onlineGrids.length; i++) {
    const score = calculateQueccaGridFitness(onlineGrids[i]);
    if (score > highestScore) {
      highestScore = score;
      bestGrid = onlineGrids[i];
    }
  }

  // 1 workload = ~0.002 Petabytes -> 2,000,000 * 0.002 = 4,000 Petabytes
  const totalOpticalPetabytes = Number(((workloads * 2) / 1000).toFixed(2));

  const dispatchHash = createHash('sha256')
    .update(`QUECCA_DISPATCH:${bestGrid.gridNodeId}:${workloads}:${totalOpticalPetabytes}:${measuredDriftFs}`)
    .digest('hex');

  return {
    targetGridId: bestGrid.gridNodeId,
    assignedWorkloads: workloads,
    totalOpticalPetabytes,
    femtosecondDriftFs: measuredDriftFs,
    dispatchHash,
  };
}
