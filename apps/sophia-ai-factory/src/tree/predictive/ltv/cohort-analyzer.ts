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
import { PseudoRandomGenerator } from './churn-estimator';

// ── 10,000-Iteration Monte Carlo Investor Relations Simulation Engine ──────

export function runMonteCarloIRSimulation(input: MonteCarloSimulationInput): {
  slices: MonthlyForecastSlice[];
  targetAchievedInP50: boolean;
  overallTargetProbability: number;
  report: InvestorRelationsForecastReport;
} {
  const iterations = input.iterations ?? GATE_9_CONSTANTS.MONTE_CARLO_ITERATIONS;
  const horizon = input.horizonMonths ?? 12;
  const startingMrr = input.startingMrrCents;
  const startingCustomers = input.startingCustomersCount;

  const meanChurn = input.meanMonthlyChurnPct ?? 0.010;
  const stdChurn = input.stdDevMonthlyChurnPct ?? 0.003;
  const meanExp = input.meanMonthlyExpansionPct ?? 0.035;
  const stdExp = input.stdDevMonthlyExpansionPct ?? 0.008;
  const meanNewCust = input.meanMonthlyNewCustomers ?? 450;
  const stdNewCust = input.stdDevMonthlyNewCustomers ?? 50;
  const newCustArpu = input.newCustomerArpuCents ?? 22000;

  const prng = new PseudoRandomGenerator(input.randomSeed ?? 1337420);
  const now = Date.now();
  const batchId = input.batchId ?? `ir_batch_${now}_${Math.random().toString(36).substring(2, 8)}`;

  // Matrix: [monthIndex 0..horizon-1][iterationIndex 0..iterations-1]
  const mrrTrajectories: Float64Array[] = Array.from({ length: horizon }, () => new Float64Array(iterations));
  const customerTrajectories: Int32Array[] = Array.from({ length: horizon }, () => new Int32Array(iterations));

  for (let iter = 0; iter < iterations; iter++) {
    let currentMrr = startingMrr;
    let currentCustomers = startingCustomers;

    for (let m = 0; m < horizon; m++) {
      const churnRate = Math.max(0.002, Math.min(0.05, prng.nextGaussian(meanChurn, stdChurn)));
      const expRate = Math.max(0.005, Math.min(0.08, prng.nextGaussian(meanExp, stdExp)));
      const newCust = Math.max(50, Math.round(prng.nextGaussian(meanNewCust, stdNewCust)));

      // Retained base
      const retainedBaseMrr = currentMrr * (1.0 - churnRate);
      const expansionMrr = retainedBaseMrr * expRate;
      const newMrr = newCust * newCustArpu;

      currentMrr = retainedBaseMrr + expansionMrr + newMrr;
      currentCustomers = Math.round(currentCustomers * (1.0 - churnRate)) + newCust;

      mrrTrajectories[m][iter] = currentMrr;
      customerTrajectories[m][iter] = currentCustomers;
    }
  }

  const slices: MonthlyForecastSlice[] = [];
  const baseYear = new Date(now).getUTCFullYear();
  const baseMonth = new Date(now).getUTCMonth() + 1;

  for (let m = 0; m < horizon; m++) {
    const monthOffset = m + 1;
    const y = baseYear + Math.floor((baseMonth + m) / 12);
    const mo = ((baseMonth + m) % 12) + 1;
    const periodStr = `${y}-${String(mo).padStart(2, '0')}`;

    // Sort MRR distribution for percentiles
    const sortedMrrs = Array.from(mrrTrajectories[m]).sort((a, b) => a - b);
    const sortedCusts = Array.from(customerTrajectories[m]).sort((a, b) => a - b);

    const p10Index = Math.min(iterations - 1, Math.floor(iterations * 0.10));
    const p50Index = Math.min(iterations - 1, Math.floor(iterations * 0.50));
    const p90Index = Math.min(iterations - 1, Math.floor(iterations * 0.90));
    const p99Index = Math.min(iterations - 1, Math.floor(iterations * 0.99));

    const p10 = Math.round(sortedMrrs[p10Index]);
    const p50 = Math.round(sortedMrrs[p50Index]);
    const p90 = Math.round(sortedMrrs[p90Index]);
    const p99 = Math.round(sortedMrrs[p99Index]);

    const expCust = Math.round(sortedCusts[p50Index]);
    const expArpu = expCust > 0 ? Math.round(p50 / expCust) : 0;

    // Hits target if MRR >= $2,500,000 USD
    let hitCount = 0;
    for (let i = 0; i < iterations; i++) {
      if (mrrTrajectories[m][i] >= GATE_9_CONSTANTS.TARGET_MRR_CENTS) {
        hitCount++;
      }
    }
    const targetProb = Number((hitCount / iterations).toFixed(4));

    const slice: MonthlyForecastSlice = {
      id: `irf_${batchId}_m${monthOffset}`,
      forecastBatchId: batchId,
      forecastPeriodMonth: periodStr,
      horizonMonthOffset: monthOffset,
      baselineMrrCents: startingMrr,
      p10PessimisticMrrCents: p10,
      p50ExpectedMrrCents: p50,
      p90OptimisticMrrCents: p90,
      p99BullCaseMrrCents: p99,
      simulatedIterations: iterations,
      expectedActiveCustomers: expCust,
      expectedArpuCents: expArpu,
      projectedNrrPct: Number((100.0 * (1.0 - meanChurn + meanExp)).toFixed(2)),
      projectedGrrPct: Number((100.0 * (1.0 - meanChurn)).toFixed(2)),
      projectedChurnRatePct: Number((meanChurn * 100).toFixed(2)),
      projectedExpansionRatePct: Number((meanExp * 100).toFixed(2)),
      targetMrrCents: GATE_9_CONSTANTS.TARGET_MRR_CENTS,
      targetCustomers: GATE_9_CONSTANTS.TARGET_CUSTOMERS,
      targetArpuCents: GATE_9_CONSTANTS.TARGET_ARPU_CENTS,
      probabilityAchievingTarget: targetProb,
      assumptions: {
        meanChurn,
        stdChurn,
        meanExp,
        stdExp,
        meanNewCust,
        stdNewCust,
        newCustArpu,
      },
      isApprovedForBoard: false,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
    };

    slices.push(slice);
  }

  const finalSlice = slices[horizon - 1];
  const targetAchievedInP50 = finalSlice.p50ExpectedMrrCents >= GATE_9_CONSTANTS.TARGET_MRR_CENTS;
  const overallTargetProbability = finalSlice.probabilityAchievingTarget;

  const report: InvestorRelationsForecastReport = {
    batchId,
    generatedAt: now,
    slices,
    targetAchievedInP50,
    overallTargetProbability,
    summary: {
      startingMrrCents: startingMrr,
      endingP50MrrCents: finalSlice.p50ExpectedMrrCents,
      endingP90MrrCents: finalSlice.p90OptimisticMrrCents,
      projectedAvgNrrPct: Number((slices.reduce((acc, s) => acc + s.projectedNrrPct, 0) / horizon).toFixed(2)),
    },
  };

  return { slices, targetAchievedInP50, overallTargetProbability, report };
}
