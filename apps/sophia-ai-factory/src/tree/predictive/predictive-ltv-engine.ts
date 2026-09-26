/**
 * Predictive LTV & Investor Relations Monte Carlo Engine
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: tree/predictive (Pure domain services & numerical simulation algorithms)
 * Imports only: @/seed
 *
 * @module tree/predictive/predictive-ltv-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type CustomerPredictiveScore,
  type CustomerPredictiveScoreRow,
  type CustomerTelemetryFeatures,
  type FeatureWeightsBreakdown,
  type InvestorRelationsForecastReport,
  type MonthlyForecastSlice,
  type MonteCarloSimulationInput,
  type PredictiveRiskLevel,
  GATE_9_CONSTANTS,
  mapRowToCustomerPredictiveScore,
} from '@/seed/types/predictive-expansion';

// ── Deterministic LCG Pseudo-Random Number Generator ───────────────────────

export class PseudoRandomGenerator {
  private seed: number;

  constructor(initialSeed = 1337420) {
    this.seed = initialSeed;
  }

  public next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /** Box-Muller transform for normal distribution */
  public nextGaussian(mean = 0, stdDev = 1): number {
    const u1 = Math.max(1e-15, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}

// ── Pure Churn Hazard Formulation ──────────────────────────────────────────

export function calculateChurnProbability(features: CustomerTelemetryFeatures): {
  churnProbability: number;
  riskLevel: PredictiveRiskLevel;
  featureWeights: FeatureWeightsBreakdown;
  healthScore: number;
} {
  const quotaSat = features.quotaMcuMonthly > 0
    ? features.usedMcuMonthly / features.quotaMcuMonthly
    : 0;

  const usageVelocity = features.videoGenerationsPrev30d > 0
    ? (features.videoGenerationsLast7d * 4 - features.videoGenerationsPrev30d) / features.videoGenerationsPrev30d
    : 0;

  const loginCadence = Math.min(1.0, Math.max(0.0, features.activeLoginsLast14d / 14));

  const errorRate = features.apiRequestsCount > 0
    ? features.apiErrorsCount / features.apiRequestsCount
    : 0;

  const tenureFactor = Math.min(1.0, Math.max(0.0, features.tenureDays / 180));
  const agentFleetActivation = Math.min(1.0, Math.max(0.0, features.activeAgentsCount / 4));

  // Calibrated logistic regression hazard weights
  const b0 = -2.2;
  const bSat = 1.2 * (1.0 - Math.min(1.0, Math.max(0.0, quotaSat)));
  const bDrop = 1.8 * Math.max(0.0, -usageVelocity);
  const bErr = 2.0 * Math.min(1.0, Math.max(0.0, errorRate * 10));
  const bLogin = 1.5 * (1.0 - loginCadence);
  const bTenure = -0.8 * tenureFactor;
  const bAgent = -0.6 * agentFleetActivation;

  const z = b0 + bSat + bDrop + bErr + bLogin + bTenure + bAgent;
  const rawProb = 1.0 / (1.0 + Math.exp(-z));
  const churnProbability = Number(Math.min(0.999, Math.max(0.001, rawProb)).toFixed(4));

  let riskLevel: PredictiveRiskLevel = 'low';
  if (churnProbability >= 0.70) riskLevel = 'critical';
  else if (churnProbability >= 0.45) riskLevel = 'high';
  else if (churnProbability >= 0.20) riskLevel = 'medium';

  const healthScore = Number(Math.max(0.0, Math.min(1.0, 1.0 - churnProbability)).toFixed(4));

  const featureWeights: FeatureWeightsBreakdown = {
    quotaSaturation: Number(quotaSat.toFixed(4)),
    usageVelocity: Number(usageVelocity.toFixed(4)),
    loginCadence: Number(loginCadence.toFixed(4)),
    errorRate: Number(errorRate.toFixed(4)),
    tenureFactor: Number(tenureFactor.toFixed(4)),
    agentFleetActivation: Number(agentFleetActivation.toFixed(4)),
  };

  return { churnProbability, riskLevel, featureWeights, healthScore };
}

// ── 24-Month Discounted Cash Flow LTV Algorithm ────────────────────────────

export function computeDiscounted24mLtv(
  currentMrrCents: number,
  churnProbability: number,
  expansionReadinessScore: number
): {
  forecastLtv24mCents: number;
  predictedMrr24mCents: number;
} {
  const mrr = Math.max(0, Math.round(currentMrrCents));
  const monthlyExpansionRate = Math.max(-0.02, Math.min(0.08, (expansionReadinessScore - 0.40) * 0.05));
  const monthlyDiscount = GATE_9_CONSTANTS.MONTHLY_DISCOUNT_RATE;

  let totalLtvCents = 0;
  let runningMrr = mrr;

  for (let month = 1; month <= 24; month++) {
    // Survival probability at month t
    const survivalRate = Math.pow(1.0 - churnProbability, month);
    // Discount factor at month t: (1 + d)^-t
    const discountFactor = Math.pow(1.0 + monthlyDiscount, -month);
    // Compound expected MRR
    runningMrr = runningMrr * (1.0 + monthlyExpansionRate);
    // Discounted cash flow
    const dcf = runningMrr * survivalRate * discountFactor;
    totalLtvCents += dcf;
  }

  const resultLtv = Math.max(0, Math.round(totalLtvCents));
  const resultMrr = Math.max(0, Math.round(runningMrr));

  return {
    forecastLtv24mCents: Number.isFinite(resultLtv) ? resultLtv : 0,
    predictedMrr24mCents: Number.isFinite(resultMrr) ? resultMrr : 0,
  };
}

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

// ── D1 Persistence Operations ───────────────────────────────────────────────

export async function saveCustomerPredictiveScore(
  db: D1Database,
  score: CustomerPredictiveScore
): Promise<CustomerPredictiveScore> {
  const stmt = db.prepare(`
    INSERT INTO customer_predictive_scores (
      id, customer_id, org_id, current_tier, tenure_days,
      current_mrr_cents, predicted_mrr_24m_cents, churn_probability,
      forecast_ltv_24m_cents, expansion_readiness_score, health_score,
      confidence_score, risk_level, expansion_stage, feature_weights_json,
      recommended_action, evaluated_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      predicted_mrr_24m_cents = excluded.predicted_mrr_24m_cents,
      churn_probability = excluded.churn_probability,
      forecast_ltv_24m_cents = excluded.forecast_ltv_24m_cents,
      expansion_readiness_score = excluded.expansion_readiness_score,
      health_score = excluded.health_score,
      risk_level = excluded.risk_level,
      expansion_stage = excluded.expansion_stage,
      feature_weights_json = excluded.feature_weights_json,
      recommended_action = excluded.recommended_action,
      updated_at = excluded.updated_at
  `);

  await stmt
    .bind(
      score.id,
      score.customerId,
      score.orgId,
      score.currentTier,
      score.tenureDays,
      score.currentMrrCents,
      score.predictedMrr24mCents,
      score.churnProbability,
      score.forecastLtv24mCents,
      score.expansionReadinessScore,
      score.healthScore,
      score.confidenceScore,
      score.riskLevel,
      score.expansionStage,
      JSON.stringify(score.featureWeights),
      score.recommendedAction,
      score.evaluatedAt,
      score.createdAt,
      score.updatedAt
    )
    .run();

  return score;
}

export async function getLatestCustomerPredictiveScore(
  db: D1Database,
  customerId: string
): Promise<CustomerPredictiveScore | null> {
  const row = await db
    .prepare('SELECT * FROM customer_predictive_scores WHERE customer_id = ? ORDER BY evaluated_at DESC LIMIT 1')
    .bind(customerId)
    .first<CustomerPredictiveScoreRow>();

  return row ? mapRowToCustomerPredictiveScore(row) : null;
}

export async function saveInvestorRelationsForecastBatch(
  db: D1Database,
  slices: MonthlyForecastSlice[]
): Promise<number> {
  let count = 0;
  for (const s of slices) {
    await db
      .prepare(`
        INSERT INTO investor_relations_forecasts (
          id, forecast_batch_id, forecast_period_month, horizon_month_offset,
          baseline_mrr_cents, p10_pessimistic_mrr_cents, p50_expected_mrr_cents,
          p90_optimistic_mrr_cents, p99_bull_case_mrr_cents, simulated_iterations,
          expected_active_customers, expected_arpu_cents, projected_nrr_pct,
          projected_grr_pct, projected_churn_rate_pct, projected_expansion_rate_pct,
          target_mrr_cents, target_customers, target_arpu_cents,
          probability_achieving_target, assumptions_json, is_approved_for_board,
          approved_by, approved_at, created_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `)
      .bind(
        s.id,
        s.forecastBatchId,
        s.forecastPeriodMonth,
        s.horizonMonthOffset,
        s.baselineMrrCents,
        s.p10PessimisticMrrCents,
        s.p50ExpectedMrrCents,
        s.p90OptimisticMrrCents,
        s.p99BullCaseMrrCents,
        s.simulatedIterations,
        s.expectedActiveCustomers,
        s.expectedArpuCents,
        s.projectedNrrPct,
        s.projectedGrrPct,
        s.projectedChurnRatePct,
        s.projectedExpansionRatePct,
        s.targetMrrCents,
        s.targetCustomers,
        s.targetArpuCents,
        s.probabilityAchievingTarget,
        JSON.stringify(s.assumptions),
        s.isApprovedForBoard ? 1 : 0,
        s.approvedBy,
        s.approvedAt,
        s.createdAt
      )
      .run();
    count++;
  }
  return count;
}
