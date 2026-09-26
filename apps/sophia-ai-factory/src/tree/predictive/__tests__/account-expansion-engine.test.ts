import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateExpansionReadiness,
  evaluateExpansionOpportunity,
  saveExpansionRecommendation,
  getActiveRecommendationsForCustomer,
  applyExpansionRecommendation,
  RECOMMENDATION_EXPIRATION_DAYS,
} from '../account-expansion-engine';
import {
  type CustomerTelemetryFeatures,
  type CustomerPredictiveScore,
  type ExpansionRecommendation,
} from '@/seed/types/predictive-expansion';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

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
    CREATE TABLE IF NOT EXISTS expansion_recommendations (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      org_id TEXT,
      score_id TEXT,
      recommendation_type TEXT NOT NULL CHECK(recommendation_type IN (
        'tier_upgrade', 'mcu_quota_expansion', 'dedicated_gpu_lane', 'custom_enterprise_sla'
      )),
      current_tier TEXT NOT NULL CHECK(current_tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
      target_tier TEXT CHECK(target_tier IS NULL OR target_tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
      current_mcu_quota INTEGER NOT NULL DEFAULT 1000 CHECK(current_mcu_quota >= 0),
      recommended_mcu_quota INTEGER NOT NULL DEFAULT 5000 CHECK(recommended_mcu_quota >= current_mcu_quota),
      current_gpu_lanes INTEGER NOT NULL DEFAULT 0 CHECK(current_gpu_lanes >= 0),
      recommended_gpu_lanes INTEGER NOT NULL DEFAULT 0 CHECK(recommended_gpu_lanes >= current_gpu_lanes),
      current_mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(current_mrr_cents >= 0),
      projected_expansion_mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(projected_expansion_mrr_cents >= 0),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending', 'notified', 'in_review', 'accepted', 'automated_applied', 'declined', 'expired'
      )),
      confidence_score REAL NOT NULL DEFAULT 0.85 CHECK(confidence_score >= 0.0 AND confidence_score <= 1.0),
      triggers_json TEXT NOT NULL DEFAULT '[]',
      rationale_vi TEXT NOT NULL,
      rationale_en TEXT NOT NULL,
      discount_offer_pct REAL NOT NULL DEFAULT 0.0 CHECK(discount_offer_pct >= 0.0 AND discount_offer_pct <= 50.0),
      applied_at INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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

function mockScore(overrides?: Partial<CustomerPredictiveScore>): CustomerPredictiveScore {
  return {
    id: 'cps_mock_001',
    customerId: 'cust_001',
    orgId: null,
    currentTier: 'BASIC',
    tenureDays: 45,
    currentMrrCents: 19900,
    predictedMrr24mCents: 25000,
    churnProbability: 0.03,
    forecastLtv24mCents: 450000,
    expansionReadinessScore: 0.72,
    healthScore: 0.97,
    confidenceScore: 0.95,
    riskLevel: 'low',
    expansionStage: 'ready',
    featureWeights: {
      quotaSaturation: 0.88,
      usageVelocity: 0.25,
      loginCadence: 0.9,
      errorRate: 0.01,
      tenureFactor: 0.5,
      agentFleetActivation: 0.5,
    },
    recommendedAction: 'tier_upgrade',
    evaluatedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Account Expansion Engine - Readiness Scoring', () => {
  it('identifies high readiness for accounts with heavy quota saturation and growth', () => {
    const features: CustomerTelemetryFeatures = {
      customerId: 'cust_fast_grow',
      currentTier: 'BASIC',
      tenureDays: 90,
      currentMrrCents: 19900,
      usedMcuMonthly: 950,
      quotaMcuMonthly: 1000, // 95% saturation
      videoGenerationsLast7d: 30,
      videoGenerationsPrev30d: 60, // strong positive velocity
      activeLoginsLast14d: 14,
      apiRequestsCount: 500,
      apiErrorsCount: 2,
      activeAgentsCount: 3,
      featuresUsedCount: 7,
    };

    const res = calculateExpansionReadiness(features);

    expect(res.expansionReadinessScore).toBeGreaterThanOrEqual(0.75);
    expect(res.expansionStage).toBe('ready');
    expect(res.recommendedAction).toBe('tier_upgrade');
  });

  it('bounds readiness score strictly in [0.0, 1.0] across edge conditions', () => {
    const emptyFeatures: CustomerTelemetryFeatures = {
      customerId: 'cust_empty',
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

    const res = calculateExpansionReadiness(emptyFeatures);
    expect(res.expansionReadinessScore).toBeGreaterThanOrEqual(0.0);
    expect(res.expansionReadinessScore).toBeLessThanOrEqual(1.0);
    expect(res.expansionStage).toBe('nurture');
    expect(res.recommendedAction).toBe('maintain');

    // Worst-case with 100% error rate
    const worstCase: CustomerTelemetryFeatures = {
      ...emptyFeatures,
      apiRequestsCount: 10,
      apiErrorsCount: 10,
    };
    const worstRes = calculateExpansionReadiness(worstCase);
    expect(worstRes.expansionReadinessScore).toBe(0);
    expect(worstRes.expansionStage).toBe('nurture');
    expect(worstRes.recommendedAction).toBe('maintain');
  });
});

describe('Account Expansion Engine - Recommendation Rules', () => {
  it('triggers BASIC -> PREMIUM upgrade when quota saturation >= 85%', () => {
    const features: CustomerTelemetryFeatures = {
      customerId: 'cust_basic_saturated',
      currentTier: 'BASIC',
      tenureDays: 30,
      currentMrrCents: UNIFIED_TIERS.BASIC.priceInCents,
      usedMcuMonthly: 880,
      quotaMcuMonthly: 1000, // 88%
      videoGenerationsLast7d: 15,
      videoGenerationsPrev30d: 40,
      activeLoginsLast14d: 10,
      apiRequestsCount: 200,
      apiErrorsCount: 0,
      activeAgentsCount: 2,
      featuresUsedCount: 4,
    };

    const score = mockScore({ customerId: features.customerId, currentTier: 'BASIC', expansionReadinessScore: 0.72 });
    const rec = evaluateExpansionOpportunity(features, score);

    expect(rec).not.toBeNull();
    expect(rec?.recommendationType).toBe('tier_upgrade');
    expect(rec?.currentTier).toBe('BASIC');
    expect(rec?.targetTier).toBe('PREMIUM');
    expect(rec?.recommendedMcuQuota).toBe(UNIFIED_TIERS.PREMIUM.mcuMonthly);
    expect(rec?.projectedExpansionMrrCents).toBe(
      UNIFIED_TIERS.PREMIUM.priceInCents - UNIFIED_TIERS.BASIC.priceInCents
    );
    expect(rec?.status).toBe('pending');
    expect(rec?.rationaleVi).toContain('PREMIUM');
    expect(rec?.rationaleEn).toContain('Growth (PREMIUM)');
  });

  it('triggers PREMIUM -> ENTERPRISE upgrade when quota saturation >= 80%', () => {
    const features: CustomerTelemetryFeatures = {
      customerId: 'cust_premium_scale',
      currentTier: 'PREMIUM',
      tenureDays: 60,
      currentMrrCents: UNIFIED_TIERS.PREMIUM.priceInCents,
      usedMcuMonthly: 4200,
      quotaMcuMonthly: 5000, // 84%
      videoGenerationsLast7d: 45,
      videoGenerationsPrev30d: 120,
      activeLoginsLast14d: 14,
      apiRequestsCount: 2000,
      apiErrorsCount: 5,
      activeAgentsCount: 4,
      featuresUsedCount: 8,
    };

    const score = mockScore({ customerId: features.customerId, currentTier: 'PREMIUM', expansionReadinessScore: 0.78 });
    const rec = evaluateExpansionOpportunity(features, score);

    expect(rec).not.toBeNull();
    expect(rec?.recommendationType).toBe('tier_upgrade');
    expect(rec?.currentTier).toBe('PREMIUM');
    expect(rec?.targetTier).toBe('ENTERPRISE');
    expect(rec?.recommendedMcuQuota).toBe(UNIFIED_TIERS.ENTERPRISE.mcuMonthly);
    expect(rec?.projectedExpansionMrrCents).toBe(
      UNIFIED_TIERS.ENTERPRISE.priceInCents - UNIFIED_TIERS.PREMIUM.priceInCents
    );
    expect(rec?.priority).toBe('high');
    expect(rec?.rationaleVi).toContain('ENTERPRISE');
    expect(rec?.rationaleEn).toContain('ENTERPRISE');
  });

  it('triggers Dedicated GPU Lane reservation for high-volume ENTERPRISE clients', () => {
    const features: CustomerTelemetryFeatures = {
      customerId: 'cust_enterprise_gpu_heavy',
      currentTier: 'ENTERPRISE',
      tenureDays: 120,
      currentMrrCents: UNIFIED_TIERS.ENTERPRISE.priceInCents,
      usedMcuMonthly: 18500,
      quotaMcuMonthly: 20000, // 92.5%
      videoGenerationsLast7d: 75, // >60 videos / week
      videoGenerationsPrev30d: 250,
      activeLoginsLast14d: 14,
      apiRequestsCount: 10000,
      apiErrorsCount: 12,
      activeAgentsCount: 4,
      featuresUsedCount: 8,
    };

    const score = mockScore({ customerId: features.customerId, currentTier: 'ENTERPRISE', expansionReadinessScore: 0.88 });
    const rec = evaluateExpansionOpportunity(features, score);

    expect(rec).not.toBeNull();
    expect(rec?.recommendationType).toBe('dedicated_gpu_lane');
    expect(rec?.currentTier).toBe('ENTERPRISE');
    expect(rec?.recommendedGpuLanes).toBe(1);
    expect(rec?.projectedExpansionMrrCents).toBe(150_000); // +$1,500/mo
    expect(rec?.discountOfferPct).toBe(5.0);
    expect(rec?.rationaleVi).toContain('Làn GPU Độc quyền');
    expect(rec?.rationaleEn).toContain('Dedicated Edge GPU Lane');
  });

  it('returns null when customer has low utilization and is not ready for expansion', () => {
    const features: CustomerTelemetryFeatures = {
      customerId: 'cust_basic_low_usage',
      currentTier: 'BASIC',
      tenureDays: 10,
      currentMrrCents: UNIFIED_TIERS.BASIC.priceInCents,
      usedMcuMonthly: 200,
      quotaMcuMonthly: 1000, // 20%
      videoGenerationsLast7d: 2,
      videoGenerationsPrev30d: 8,
      activeLoginsLast14d: 3,
      apiRequestsCount: 50,
      apiErrorsCount: 0,
      activeAgentsCount: 1,
      featuresUsedCount: 2,
    };

    const score = mockScore({ customerId: features.customerId, currentTier: 'BASIC', expansionReadinessScore: 0.35 });
    const rec = evaluateExpansionOpportunity(features, score);

    expect(rec).toBeNull();
  });
});

describe('Account Expansion Engine - D1 Persistence & Lifecycle', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('persists, queries active recommendations, and applies accepted upgrade', async () => {
    const now = Date.now();
    const expiresAt = now + RECOMMENDATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

    const rec: ExpansionRecommendation = {
      id: 'rec_test_user_001',
      customerId: 'user_123',
      orgId: null,
      scoreId: 'cps_001',
      recommendationType: 'tier_upgrade',
      currentTier: 'BASIC',
      targetTier: 'PREMIUM',
      currentMcuQuota: 1000,
      recommendedMcuQuota: 5000,
      currentGpuLanes: 0,
      recommendedGpuLanes: 0,
      currentMrrCents: 19900,
      projectedExpansionMrrCents: 20000,
      priority: 'high',
      status: 'pending',
      confidenceScore: 0.92,
      triggers: ['mcu_saturation_high'],
      rationaleVi: 'Nâng cấp gói Tăng trưởng để nhận 5.000 MCU',
      rationaleEn: 'Upgrade to Growth for 5,000 MCU',
      discountOfferPct: 10.0,
      appliedAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    await saveExpansionRecommendation(db, rec);

    // Query active
    const active = await getActiveRecommendationsForCustomer(db, 'user_123');
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('rec_test_user_001');
    expect(active[0].status).toBe('pending');
    expect(active[0].projectedExpansionMrrCents).toBe(20000);

    // Apply recommendation
    const applyRes = await applyExpansionRecommendation(db, 'rec_test_user_001');
    expect(applyRes.success).toBe(true);
    expect(applyRes.appliedAt).toBeGreaterThan(0);

    // Active list should now be empty (since status is 'accepted')
    const activeAfter = await getActiveRecommendationsForCustomer(db, 'user_123');
    expect(activeAfter).toHaveLength(0);
  });
});
