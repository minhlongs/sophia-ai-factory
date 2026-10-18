/**
 * Monte Carlo Trajectory Simulator & Slice Aggregator
 *
 * Layer: tree/predictive/ltv
 */

import { type MonthlyForecastSlice, GATE_9_CONSTANTS } from '@/seed/types/predictive-expansion';
import { PseudoRandomGenerator } from './churn-estimator';

export interface TrajectorySimulationParams {
  iterations: number;
  horizon: number;
  startingMrr: number;
  startingCustomers: number;
  meanChurn: number;
  stdChurn: number;
  meanExp: number;
  stdExp: number;
  meanNewCust: number;
  stdNewCust: number;
  newCustArpu: number;
  randomSeed: number;
}

export function simulateTrajectories(params: TrajectorySimulationParams): {
  mrrTrajectories: Float64Array[];
  customerTrajectories: Int32Array[];
} {
  const {
    iterations, horizon, startingMrr, startingCustomers,
    meanChurn, stdChurn, meanExp, stdExp, meanNewCust, stdNewCust, newCustArpu, randomSeed,
  } = params;

  const prng = new PseudoRandomGenerator(randomSeed);
  const mrrTrajectories: Float64Array[] = Array.from({ length: horizon }, () => new Float64Array(iterations));
  const customerTrajectories: Int32Array[] = Array.from({ length: horizon }, () => new Int32Array(iterations));

  for (let iter = 0; iter < iterations; iter++) {
    let currentMrr = startingMrr;
    let currentCustomers = startingCustomers;

    for (let m = 0; m < horizon; m++) {
      const churnRate = Math.max(0.002, Math.min(0.05, prng.nextGaussian(meanChurn, stdChurn)));
      const expRate = Math.max(0.005, Math.min(0.08, prng.nextGaussian(meanExp, stdExp)));
      const newCust = Math.max(50, Math.round(prng.nextGaussian(meanNewCust, stdNewCust)));

      const retainedBaseMrr = currentMrr * (1.0 - churnRate);
      currentMrr = retainedBaseMrr + retainedBaseMrr * expRate + newCust * newCustArpu;
      currentCustomers = Math.round(currentCustomers * (1.0 - churnRate)) + newCust;

      mrrTrajectories[m][iter] = currentMrr;
      customerTrajectories[m][iter] = currentCustomers;
    }
  }

  return { mrrTrajectories, customerTrajectories };
}

export function computePercentileSlice(
  m: number,
  batchId: string,
  now: number,
  mrrRow: Float64Array,
  custRow: Int32Array,
  params: TrajectorySimulationParams,
): MonthlyForecastSlice {
  const { iterations, startingMrr, meanChurn, stdChurn, meanExp, stdExp, meanNewCust, stdNewCust, newCustArpu } = params;
  const baseYear = new Date(now).getUTCFullYear();
  const baseMonth = new Date(now).getUTCMonth() + 1;
  const monthOffset = m + 1;
  const y = baseYear + Math.floor((baseMonth + m) / 12);
  const mo = ((baseMonth + m) % 12) + 1;

  const sortedMrrs = Array.from(mrrRow).sort((a, b) => a - b);
  const sortedCusts = Array.from(custRow).sort((a, b) => a - b);
  const idx = (pct: number) => Math.min(iterations - 1, Math.floor(iterations * pct));

  const p50 = Math.round(sortedMrrs[idx(0.50)]);
  const expCust = Math.round(sortedCusts[idx(0.50)]);

  let hitCount = 0;
  for (let i = 0; i < iterations; i++) {
    if (mrrRow[i] >= GATE_9_CONSTANTS.TARGET_MRR_CENTS) hitCount++;
  }

  return {
    id: `irf_${batchId}_m${monthOffset}`,
    forecastBatchId: batchId,
    forecastPeriodMonth: `${y}-${String(mo).padStart(2, '0')}`,
    horizonMonthOffset: monthOffset,
    baselineMrrCents: startingMrr,
    p10PessimisticMrrCents: Math.round(sortedMrrs[idx(0.10)]),
    p50ExpectedMrrCents: p50,
    p90OptimisticMrrCents: Math.round(sortedMrrs[idx(0.90)]),
    p99BullCaseMrrCents: Math.round(sortedMrrs[idx(0.99)]),
    simulatedIterations: iterations,
    expectedActiveCustomers: expCust,
    expectedArpuCents: expCust > 0 ? Math.round(p50 / expCust) : 0,
    projectedNrrPct: Number((100.0 * (1.0 - meanChurn + meanExp)).toFixed(2)),
    projectedGrrPct: Number((100.0 * (1.0 - meanChurn)).toFixed(2)),
    projectedChurnRatePct: Number((meanChurn * 100).toFixed(2)),
    projectedExpansionRatePct: Number((meanExp * 100).toFixed(2)),
    targetMrrCents: GATE_9_CONSTANTS.TARGET_MRR_CENTS,
    targetCustomers: GATE_9_CONSTANTS.TARGET_CUSTOMERS,
    targetArpuCents: GATE_9_CONSTANTS.TARGET_ARPU_CENTS,
    probabilityAchievingTarget: Number((hitCount / iterations).toFixed(4)),
    assumptions: { meanChurn, stdChurn, meanExp, stdExp, meanNewCust, stdNewCust, newCustArpu },
    isApprovedForBoard: false,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
  };
}
