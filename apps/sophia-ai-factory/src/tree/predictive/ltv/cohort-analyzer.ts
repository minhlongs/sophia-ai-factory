/**
 * Monte Carlo Investor Relations Simulation & Cohort Analyzer
 *
 * Layer: tree/predictive/ltv
 */

import {
  type InvestorRelationsForecastReport,
  type MonthlyForecastSlice,
  type MonteCarloSimulationInput,
  GATE_9_CONSTANTS,
} from '@/seed/types/predictive-expansion';
import {
  computePercentileSlice,
  simulateTrajectories,
  type TrajectorySimulationParams,
} from './cohort-trajectory-simulator';

// ── 10,000-Iteration Monte Carlo Investor Relations Simulation Engine ──────

export function runMonteCarloIRSimulation(input: MonteCarloSimulationInput): {
  slices: MonthlyForecastSlice[];
  targetAchievedInP50: boolean;
  overallTargetProbability: number;
  report: InvestorRelationsForecastReport;
} {
  const params: TrajectorySimulationParams = {
    iterations: input.iterations ?? GATE_9_CONSTANTS.MONTE_CARLO_ITERATIONS,
    horizon: input.horizonMonths ?? 12,
    startingMrr: input.startingMrrCents,
    startingCustomers: input.startingCustomersCount,
    meanChurn: input.meanMonthlyChurnPct ?? 0.010,
    stdChurn: input.stdDevMonthlyChurnPct ?? 0.003,
    meanExp: input.meanMonthlyExpansionPct ?? 0.035,
    stdExp: input.stdDevMonthlyExpansionPct ?? 0.008,
    meanNewCust: input.meanMonthlyNewCustomers ?? 450,
    stdNewCust: input.stdDevMonthlyNewCustomers ?? 50,
    newCustArpu: input.newCustomerArpuCents ?? 22000,
    randomSeed: input.randomSeed ?? 1337420,
  };

  const now = Date.now();
  const batchId = input.batchId ?? `ir_batch_${now}_${Math.random().toString(36).substring(2, 8)}`;

  const { mrrTrajectories, customerTrajectories } = simulateTrajectories(params);

  const slices: MonthlyForecastSlice[] = [];
  for (let m = 0; m < params.horizon; m++) {
    slices.push(
      computePercentileSlice(
        m,
        batchId,
        now,
        mrrTrajectories[m],
        customerTrajectories[m],
        params,
      ),
    );
  }

  const finalSlice = slices[params.horizon - 1];
  const targetAchievedInP50 = finalSlice.p50ExpectedMrrCents >= GATE_9_CONSTANTS.TARGET_MRR_CENTS;
  const overallTargetProbability = finalSlice.probabilityAchievingTarget;

  const report: InvestorRelationsForecastReport = {
    batchId,
    generatedAt: now,
    slices,
    targetAchievedInP50,
    overallTargetProbability,
    summary: {
      startingMrrCents: params.startingMrr,
      endingP50MrrCents: finalSlice.p50ExpectedMrrCents,
      endingP90MrrCents: finalSlice.p90OptimisticMrrCents,
      projectedAvgNrrPct: Number(
        (slices.reduce((acc, s) => acc + s.projectedNrrPct, 0) / params.horizon).toFixed(2),
      ),
    },
  };

  return { slices, targetAchievedInP50, overallTargetProbability, report };
}
