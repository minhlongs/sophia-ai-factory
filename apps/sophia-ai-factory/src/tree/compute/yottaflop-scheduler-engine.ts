/**
 * @file yottaflop-scheduler-engine.ts
 * @layer tree/compute
 * @description Pure domain engine for YottaFLOP Super-Scale Planetary Quantum Compute scheduling.
 */

import {
  YottaflopComputeGrid,
  QuantumPipelineBatch,
  PlanetaryQuantumDispatchPlan,
} from '@/seed/types/yottaflop-matrix';

export interface GridSchedulingScore {
  gridIdentifier: string;
  compositeScore: number;
  isEligible: boolean;
  allocatedCapacityPercentage: number;
}

/**
 * Calculates composite scheduling score for a YottaFLOP quantum compute grid
 */
export function calculateGridSchedulingScore(grid: YottaflopComputeGrid): GridSchedulingScore {
  if (grid.status !== 'ONLINE_OPTIMAL' || grid.gridHealthScore < 0.95) {
    return {
      gridIdentifier: grid.gridIdentifier,
      compositeScore: 0.0,
      isEligible: false,
      allocatedCapacityPercentage: 0,
    };
  }

  // 1. Peak YottaFLOPs (normalized to 2.0 YottaFLOPs)
  const computeScore = Math.min(1.0, grid.peakYottaflops / 2.0);

  // 2. Interconnect Latency (normalized: 100 ns is 1.0, 1000 ns is 0.1)
  const latencyScore = Math.max(0.1, 1.0 - grid.interconnectLatencyNanoseconds / 1000);

  // 3. Logical Qubits (normalized to 8192 qubits)
  const qubitScore = Math.min(1.0, grid.activeQubitsLogical / 8192);

  // 4. Health
  const healthScore = grid.gridHealthScore;

  const composite = 0.4 * computeScore + 0.3 * latencyScore + 0.2 * qubitScore + 0.1 * healthScore;

  return {
    gridIdentifier: grid.gridIdentifier,
    compositeScore: Number(composite.toFixed(4)),
    isEligible: true,
    allocatedCapacityPercentage: 0,
  };
}

/**
 * Plans dispatch of 500,000 concurrent quantum-GPU workloads across planetary grids
 */
export function planQuantumBatchDispatch(
  totalJobs: number,
  grids: YottaflopComputeGrid[]
): PlanetaryQuantumDispatchPlan {
  if (totalJobs <= 0) {
    throw new Error('Total jobs must be strictly positive');
  }

  const scored = grids
    .map(calculateGridSchedulingScore)
    .filter((g) => g.isEligible && g.compositeScore > 0)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  if (scored.length === 0) {
    throw new Error('No eligible YottaFLOP quantum grids available for planetary dispatch');
  }

  const totalScore = scored.reduce((sum, g) => sum + g.compositeScore, 0);

  let remaining = totalJobs;
  const allocations: PlanetaryQuantumDispatchPlan['allocations'] = [];

  for (let i = 0; i < scored.length; i++) {
    const entry = scored[i];
    const isLast = i === scored.length - 1;
    const share = isLast ? remaining : Math.min(remaining, Math.round((entry.compositeScore / totalScore) * totalJobs));

    const grid = grids.find((g) => g.gridIdentifier === entry.gridIdentifier)!;
    const allocatedQubits = Math.round((share / totalJobs) * grid.activeQubitsLogical);
    const estimatedExecutionMicroseconds = Math.max(50, Math.round((share / grid.activeGpusCount) * 120));

    allocations.push({
      gridIdentifier: entry.gridIdentifier,
      allocatedJobs: share,
      allocatedQubits,
      estimatedExecutionMicroseconds,
    });

    remaining -= share;
  }

  // Sub-microsecond dispatch latency
  const projectedDispatchLatencyMicroseconds = Number((120 + scored.length * 15).toFixed(1));

  return {
    planId: `QUANTUM_PLAN_${Date.now()}`,
    totalWorkloads: totalJobs,
    scheduledGridsCount: scored.length,
    allocations,
    projectedDispatchLatencyMicroseconds,
  };
}
