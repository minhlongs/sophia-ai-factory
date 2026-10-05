/**
 * @file queccaflop-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for QueccaFLOP Photonic-Quantum Grids & 2,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import { planParameterizedBatchDispatch } from './sub-planck-scheduler-domain-engine';

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
  const plan = planParameterizedBatchDispatch(grids, workloads, measuredDriftFs, {
    maxClockDriftFs: ELEVEN_NINES_SLA_CONSTANTS.MAX_FEMTOSECOND_DRIFT_FS,
    clockDriftErrorMessageFn: (drift, max) => `Femtosecond relativistic clock drift ${drift} fs exceeds allowable threshold ${max} fs`,
    stableStatus: 'ONLINE_SUPERCONDUCTING',
    statusGetter: (m) => (m as unknown as Record<string, unknown>).status as string,
    refGetter: (m) => (m as unknown as Record<string, unknown>).gridNodeId as string,
    fitnessFn: (m) => calculateQueccaGridFitness(m as never),
    bandwidthPerWorkloadPb: 0.002,
    zeroStableMeshesErrorMessage: 'Zero online superconducting QueccaFLOP grids available for dispatch',
    dispatchHashFn: (ctx) =>
      createHash('sha256')
        .update(`QUECCA_DISPATCH:${ctx.targetMeshRef}:${ctx.assignedWorkloads}:${ctx.totalBandwidthPetabytes}:${ctx.measuredDriftFs}`)
        .digest('hex'),
  });

  return plan as unknown as QueccaDispatchPlan;
}
