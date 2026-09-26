import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateChurnProbability,
  computeDiscounted24mLtv,
  runMonteCarloIRSimulation,
  saveCustomerPredictiveScore,
  getLatestCustomerPredictiveScore,
  saveInvestorRelationsForecastBatch,
  PseudoRandomGenerator,
} from '../predictive-ltv-engine';
import {
  type CustomerTelemetryFeatures,
  type CustomerPredictiveScore,
  GATE_9_CONSTANTS,
} from '@/seed/types/predictive-expansion';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function createTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_predictive_scores (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      org_id TEXT,
      current_tier TEXT NOT NULL CHECK(current_tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
      tenure_days INTEGER NOT NULL DEFAULT 0 CHECK(tenure_days >= 0),
      current_mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(current_mrr_cents >= 0),
      predicted_mrr_24m_cents INTEGER NOT NULL DEFAULT 0 CHECK(predicted_mrr_24m_cents >= 0),
      churn_probability REAL NOT NULL DEFAULT 0.0 CHECK(churn_probability >= 0.0 AND churn_probability <= 1.0),
      forecast_ltv_24m_cents INTEGER NOT NULL DEFAULT 0 CHECK(forecast_ltv_24m_cents >= 0),
      expansion_readiness_score REAL NOT NULL DEFAULT 0.0 CHECK(expansion_readiness_score >= 0.0 AND expansion_readiness_score <= 1.0),
      health_score REAL NOT NULL DEFAULT 1.0 CHECK(health_score >= 0.0 AND health_score <= 1.0),
      confidence_score REAL NOT NULL DEFAULT 0.95 CHECK(confidence_score >= 0.0 AND confidence_score <= 1.0),
      risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
      expansion_stage TEXT NOT NULL DEFAULT 'nurture' CHECK(expansion_stage IN ('nurture', 'ready', 'engaged', 'negotiating', 'expanded', 'stalled')),
      feature_weights_json TEXT NOT NULL DEFAULT '{}',
      recommended_action TEXT NOT NULL DEFAULT 'maintain' CHECK(recommended_action IN (
        'maintain', 'proactive_retention', 'quota_expansion', 'tier_upgrade', 'enterprise_gpu_lane', 'custom_contract'
      )),
      evaluated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investor_relations_forecasts (
      id TEXT PRIMARY KEY,
      forecast_batch_id TEXT NOT NULL,
      forecast_period_month TEXT NOT NULL,
      horizon_month_offset INTEGER NOT NULL CHECK(horizon_month_offset >= 1 AND horizon_month_offset <= 12),
      baseline_mrr_cents INTEGER NOT NULL CHECK(baseline_mrr_cents >= 0),
      p10_pessimistic_mrr_cents INTEGER NOT NULL CHECK(p10_pessimistic_mrr_cents >= 0),
      p50_expected_mrr_cents INTEGER NOT NULL CHECK(p50_expected_mrr_cents >= p10_pessimistic_mrr_cents),
      p90_optimistic_mrr_cents INTEGER NOT NULL CHECK(p90_optimistic_mrr_cents >= p50_expected_mrr_cents),
      p99_bull_case_mrr_cents INTEGER NOT NULL CHECK(p99_bull_case_mrr_cents >= p90_optimistic_mrr_cents),
      simulated_iterations INTEGER NOT NULL DEFAULT 10000 CHECK(simulated_iterations > 0),
      expected_active_customers INTEGER NOT NULL CHECK(expected_active_customers >= 0),
      expected_arpu_cents INTEGER NOT NULL CHECK(expected_arpu_cents >= 0),
      projected_nrr_pct REAL NOT NULL CHECK(projected_nrr_pct >= 0.0),
      projected_grr_pct REAL NOT NULL CHECK(projected_grr_pct >= 0.0 AND projected_grr_pct <= 100.0),
      projected_churn_rate_pct REAL NOT NULL CHECK(projected_churn_rate_pct >= 0.0 AND projected_churn_rate_pct <= 100.0),
      projected_expansion_rate_pct REAL NOT NULL CHECK(projected_expansion_rate_pct >= 0.0),
      target_mrr_cents INTEGER NOT NULL DEFAULT 250000000,
      target_customers INTEGER NOT NULL DEFAULT 10000,
      target_arpu_cents INTEGER NOT NULL DEFAULT 25000,
      probability_achieving_target REAL NOT NULL CHECK(probability_achieving_target >= 0.0 AND probability_achieving_target <= 1.0),
      assumptions_json TEXT NOT NULL DEFAULT '{}',
      is_approved_for_board INTEGER NOT NULL DEFAULT 0 CHECK(is_approved_for_board IN (0, 1)),
      approved_by TEXT,
      approved_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

describe('Predictive LTV & Churn Modeling Engine', () => {
  it('correctly calculates low churn risk for highly engaged customer', () => {
    const features: CustomerTelemetryFeatures = {
      customerId: 'cust_healthy_001',
      currentTier: 'PREMIUM',
      tenureDays: 120,
      currentMrrCents: 39900,
      usedMcuMonthly: 4500,
      quotaMcuMonthly: 5000, // 90% saturation
      videoGenerationsLast7d: 25,
      videoGenerationsPrev30d: 80, // positive velocity
      activeLoginsLast14d: 14, // daily logins
      apiRequestsCount: 1000,
      apiErrorsCount: 1, // 0.1% error rate
      activeAgentsCount: 4, // fully activated fleet
      featuresUsedCount: 7,
    };

    const result = calculateChurnProbability(features);

    expect(result.churnProbability).toBeLessThan(0.20);
    expect(result.riskLevel).toBe('low');
    expect(result.healthScore).toBeGreaterThan(0.80);
    expect(result.featureWeights.quotaSaturation).toBe(0.9);
    expect(result.featureWeights.loginCadence).toBe(1.0);
  });

  it('correctly calculates high churn risk for inactive degrading customer', () => {
    const features: CustomerTelemetryFeatures = {
      customerId: 'cust_at_risk_002',
      currentTier: 'BASIC',
      tenureDays: 15,
      currentMrrCents: 19900,
      usedMcuMonthly: 50,
      quotaMcuMonthly: 1000, // 5% saturation
      videoGenerationsLast7d: 0,
      videoGenerationsPrev30d: 20, // 100% velocity drop
      activeLoginsLast14d: 1, // 1 login in 14 days
      apiRequestsCount: 200,
      apiErrorsCount: 60, // 30% error rate
      activeAgentsCount: 0,
      featuresUsedCount: 1,
    };

    const result = calculateChurnProbability(features);

    expect(result.churnProbability).toBeGreaterThan(0.45);
    expect(['high', 'critical']).toContain(result.riskLevel);
    expect(result.healthScore).toBeLessThan(0.55);
  });

  it('strictly bounds churn probability in [0.001, 0.999] under extreme edge cases', () => {
    const zeroFeatures: CustomerTelemetryFeatures = {
      customerId: 'cust_zero',
      currentTier: 'BASIC',
      tenureDays: 0,
      currentMrrCents: 0,
      usedMcuMonthly: 0,
      quotaMcuMonthly: 0,
      videoGenerationsLast7d: 0,
      videoGenerationsPrev30d: 0,
      activeLoginsLast14d: 0,
      apiRequestsCount: 0,
      apiErrorsCount: 0,
      activeAgentsCount: 0,
      featuresUsedCount: 0,
    };

    const res = calculateChurnProbability(zeroFeatures);
    expect(res.churnProbability).toBeGreaterThanOrEqual(0.001);
    expect(res.churnProbability).toBeLessThanOrEqual(0.999);
    expect(res.healthScore).toBeGreaterThanOrEqual(0.0);
    expect(res.healthScore).toBeLessThanOrEqual(1.0);
    expect(Number.isFinite(res.churnProbability)).toBe(true);
  });
});

describe('24-Month Discounted Cash Flow LTV Algorithm', () => {
  it('computes positive finite LTV for standard subscription', () => {
    const currentMrrCents = 39900; // $399
    const churnProbability = 0.05; // 5% monthly
    const expansionReadiness = 0.65;

    const ltv = computeDiscounted24mLtv(currentMrrCents, churnProbability, expansionReadiness);

    expect(ltv.forecastLtv24mCents).toBeGreaterThan(currentMrrCents);
    expect(Number.isInteger(ltv.forecastLtv24mCents)).toBe(true);
    expect(Number.isFinite(ltv.forecastLtv24mCents)).toBe(true);
    expect(ltv.predictedMrr24mCents).toBeGreaterThan(0);
  });

  it('reflects higher LTV for customers with lower churn probability (monotonicity)', () => {
    const mrr = 50000;
    const expansion = 0.50;

    const lowChurnLtv = computeDiscounted24mLtv(mrr, 0.02, expansion);
    const highChurnLtv = computeDiscounted24mLtv(mrr, 0.15, expansion);

    expect(lowChurnLtv.forecastLtv24mCents).toBeGreaterThan(highChurnLtv.forecastLtv24mCents);
  });

  it('handles boundary conditions: 0 MRR produces 0 LTV without NaN', () => {
    const ltv = computeDiscounted24mLtv(0, 0.10, 0.50);
    expect(ltv.forecastLtv24mCents).toBe(0);
    expect(ltv.predictedMrr24mCents).toBe(0);
    expect(Number.isNaN(ltv.forecastLtv24mCents)).toBe(false);
  });

  it('handles huge MRR without overflow or precision loss', () => {
    const hugeMrr = 10_000_000_00; // $10,000,000 / month
    const ltv = computeDiscounted24mLtv(hugeMrr, 0.01, 0.80);
    expect(ltv.forecastLtv24mCents).toBeGreaterThan(hugeMrr);
    expect(Number.isFinite(ltv.forecastLtv24mCents)).toBe(true);
  });
});

describe('10,000-Iteration Monte Carlo Investor Relations Simulation', () => {
  it('executes 10,000 iterations without NaN or overflow, verifying percentile order', () => {
    const input = {
      startingMrrCents: 100_000_000, // Gate 8: $1,000,000 MRR
      startingCustomersCount: 5_000,
      iterations: 10_000,
      horizonMonths: 12,
      randomSeed: 424242,
    };

    const { slices, report, overallTargetProbability } = runMonteCarloIRSimulation(input);

    expect(slices).toHaveLength(12);
    expect(report.summary.startingMrrCents).toBe(100_000_000);
    expect(overallTargetProbability).toBeGreaterThanOrEqual(0.0);
    expect(overallTargetProbability).toBeLessThanOrEqual(1.0);

    for (const slice of slices) {
      // Invariance: P10 <= P50 <= P90 <= P99
      expect(slice.p10PessimisticMrrCents).toBeLessThanOrEqual(slice.p50ExpectedMrrCents);
      expect(slice.p50ExpectedMrrCents).toBeLessThanOrEqual(slice.p90OptimisticMrrCents);
      expect(slice.p90OptimisticMrrCents).toBeLessThanOrEqual(slice.p99BullCaseMrrCents);

      // Invariance: No NaN or negative numbers
      expect(Number.isNaN(slice.p10PessimisticMrrCents)).toBe(false);
      expect(Number.isNaN(slice.p50ExpectedMrrCents)).toBe(false);
      expect(Number.isNaN(slice.p90OptimisticMrrCents)).toBe(false);
      expect(Number.isNaN(slice.p99BullCaseMrrCents)).toBe(false);
      expect(slice.p10PessimisticMrrCents).toBeGreaterThan(0);

      // Customers and ARPU
      expect(slice.expectedActiveCustomers).toBeGreaterThan(0);
      expect(slice.expectedArpuCents).toBeGreaterThan(0);

      // Target constants
      expect(slice.targetMrrCents).toBe(GATE_9_CONSTANTS.TARGET_MRR_CENTS);
      expect(slice.targetCustomers).toBe(GATE_9_CONSTANTS.TARGET_CUSTOMERS);
      expect(slice.targetArpuCents).toBe(GATE_9_CONSTANTS.TARGET_ARPU_CENTS);
    }
  });

  it('verifies PRNG reproducibility with seeded LCG', () => {
    const prng1 = new PseudoRandomGenerator(99999);
    const prng2 = new PseudoRandomGenerator(99999);

    for (let i = 0; i < 50; i++) {
      expect(prng1.next()).toBe(prng2.next());
      expect(prng1.nextGaussian()).toBe(prng2.nextGaussian());
    }
  });
});

describe('Predictive D1 Persistence', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('saves and retrieves latest customer predictive score', async () => {
    const score: CustomerPredictiveScore = {
      id: 'cps_test_001',
      customerId: 'user_xyz',
      orgId: null,
      currentTier: 'PREMIUM',
      tenureDays: 60,
      currentMrrCents: 39900,
      predictedMrr24mCents: 45000,
      churnProbability: 0.045,
      forecastLtv24mCents: 750000,
      expansionReadinessScore: 0.82,
      healthScore: 0.955,
      confidenceScore: 0.95,
      riskLevel: 'low',
      expansionStage: 'ready',
      featureWeights: {
        quotaSaturation: 0.85,
        usageVelocity: 0.30,
        loginCadence: 1.0,
        errorRate: 0.01,
        tenureFactor: 0.33,
        agentFleetActivation: 1.0,
      },
      recommendedAction: 'tier_upgrade',
      evaluatedAt: 1774600000000,
      createdAt: 1774600000000,
      updatedAt: 1774600000000,
    };

    await saveCustomerPredictiveScore(db, score);
    const retrieved = await getLatestCustomerPredictiveScore(db, 'user_xyz');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('cps_test_001');
    expect(retrieved?.customerId).toBe('user_xyz');
    expect(retrieved?.churnProbability).toBe(0.045);
    expect(retrieved?.forecastLtv24mCents).toBe(750000);
    expect(retrieved?.featureWeights.quotaSaturation).toBe(0.85);
  });

  it('persists a 12-month investor relations forecast batch', async () => {
    const { slices } = runMonteCarloIRSimulation({
      startingMrrCents: 100_000_000,
      startingCustomersCount: 5_000,
      iterations: 500,
      horizonMonths: 12,
      randomSeed: 12345,
    });

    const count = await saveInvestorRelationsForecastBatch(db, slices);
    expect(count).toBe(12);

    const check = await db.prepare('SELECT COUNT(*) as cnt FROM investor_relations_forecasts').first<{ cnt: number }>();
    expect(check?.cnt).toBe(12);
  });
});
