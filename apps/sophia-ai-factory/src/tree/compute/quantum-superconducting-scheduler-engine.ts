/**
 * @file quantum-superconducting-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for Quantum Superconducting Matrix & 10,000,000 Workload Dispatching.
 */

import { createHash } from 'node:crypto';
import { planParameterizedBatchDispatch } from './sub-planck-scheduler-domain-engine';

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
  const plan = planParameterizedBatchDispatch(matrices, workloads, measuredDriftFs, {
    maxClockDriftFs: THIRTEEN_NINES_SLA_CONSTANTS.MAX_QUANTUM_CLOCK_DRIFT_FS,
    clockDriftErrorMessageFn: (drift, max) => `Quantum relativistic clock drift ${drift} fs exceeds allowable threshold ${max} fs`,
    stableStatus: 'CRITICAL_FLUX_STABLE',
    statusGetter: (m) => (m as unknown as Record<string, unknown>).superconductingStatus as string,
    refGetter: (m) => (m as unknown as Record<string, unknown>).matrixRef as string,
    fitnessFn: (m) => calculateQuantumMatrixFitness(m as never),
    bandwidthPerWorkloadPb: 0.002,
    zeroStableMeshesErrorMessage: 'Zero stable superconducting Quantum matrices available for dispatch',
    dispatchHashFn: (ctx) =>
      createHash('sha256')
        .update(`QUANTUM_DISPATCH:${ctx.targetMeshRef}:${ctx.assignedWorkloads}:${ctx.totalBandwidthPetabytes}:${ctx.measuredDriftFs}`)
        .digest('hex'),
  });

  return plan as unknown as QuantumDispatchPlan;
}
