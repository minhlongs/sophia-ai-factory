/**
 * @file ronanflop-optical-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for RonanFLOP Optical-Quantum Grids & 1,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import { planParameterizedBatchDispatch } from './sub-planck-scheduler-domain-engine';

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
  const plan = planParameterizedBatchDispatch(grids, workloads, measuredDriftPs, {
    maxClockDriftFs: TEN_NINES_SLA_CONSTANTS.MAX_RELATIVISTIC_DOPPLER_PS,
    clockDriftErrorMessageFn: (drift, max) => `Relativistic Doppler clock drift ${drift} ps exceeds allowable threshold ${max} ps`,
    stableStatus: 'ONLINE_SUPERCONDUCTING',
    statusGetter: (m) => (m as unknown as Record<string, unknown>).status as string,
    refGetter: (m) => (m as unknown as Record<string, unknown>).gridNodeId as string,
    fitnessFn: (m) => calculateOpticalGridFitness(m as never),
    bandwidthPerWorkloadPb: 0.002,
    zeroStableMeshesErrorMessage: 'Zero online superconducting RonanFLOP grids available for dispatch',
    dispatchHashFn: (ctx) =>
      createHash('sha256')
        .update(`OPTICAL_DISPATCH:${ctx.targetMeshRef}:${ctx.assignedWorkloads}:${ctx.totalBandwidthPetabytes}:${ctx.measuredDriftFs}`)
        .digest('hex'),
  });

  return plan as unknown as OpticalDispatchPlan;
}
