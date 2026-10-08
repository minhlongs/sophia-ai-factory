import { describe, it, expect, vi } from 'vitest';
import { enforceLtvBudgetConstraints } from '../serverless-budget-router';
import * as predictiveEngine from '@/tree/predictive/predictive-ltv-engine';
import type { D1Database } from '@cloudflare/workers-types';
import type { FeatureWeightsBreakdown } from '@/seed/types/predictive-expansion';

describe('enforceLtvBudgetConstraints', () => {
  const mockDb = {} as unknown as D1Database;
  const dummyWeights: FeatureWeightsBreakdown = {
    quotaSaturation: 0.5,
    usageVelocity: 0.5,
    loginCadence: 0.5,
    errorRate: 0.0,
    tenureFactor: 0.5,
    agentFleetActivation: 0.5,
  };

  it('fails when customerId is missing', async () => {
    const res = await enforceLtvBudgetConstraints(mockDb, {
      customerId: '',
      requestedCostCents: 100,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('MISSING_CUSTOMER_ID');
    }
  });

  it('allows immediately when requestedCostCents is 0', async () => {
    const res = await enforceLtvBudgetConstraints(mockDb, {
      customerId: 'cust_123',
      requestedCostCents: 0,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.allowed).toBe(true);
    }
  });

  it('fails if customer has no predictive score', async () => {
    vi.spyOn(predictiveEngine, 'getLatestCustomerPredictiveScore').mockResolvedValue(null);

    const res = await enforceLtvBudgetConstraints(mockDb, {
      customerId: 'cust_unknown',
      requestedCostCents: 100,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NO_PREDICTIVE_SCORE');
    }
  });

  it('disallows if risk level is critical', async () => {
    vi.spyOn(predictiveEngine, 'getLatestCustomerPredictiveScore').mockResolvedValue({
      id: 'score_1',
      customerId: 'cust_crit',
      orgId: 'org_1',
      currentTier: 'BASIC',
      tenureDays: 30,
      currentMrrCents: 5000,
      predictedMrr24mCents: 5000,
      churnProbability: 0.85,
      forecastLtv24mCents: 10000,
      expansionReadinessScore: 0.1,
      healthScore: 0.15,
      confidenceScore: 0.9,
      riskLevel: 'critical',
      expansionStage: 'stalled',
      featureWeights: dummyWeights,
      recommendedAction: 'proactive_retention',
      evaluatedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const res = await enforceLtvBudgetConstraints(mockDb, {
      customerId: 'cust_crit',
      requestedCostCents: 50,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.allowed).toBe(false);
      expect(res.value.reason).toContain('critical churn risk');
    }
  });

  it('approves when cost is within limits', async () => {
    vi.spyOn(predictiveEngine, 'getLatestCustomerPredictiveScore').mockResolvedValue({
      id: 'score_1',
      customerId: 'cust_ok',
      orgId: 'org_1',
      currentTier: 'PREMIUM',
      tenureDays: 120,
      currentMrrCents: 20000,
      predictedMrr24mCents: 25000,
      churnProbability: 0.05,
      forecastLtv24mCents: 500000,
      expansionReadinessScore: 0.8,
      healthScore: 0.95,
      confidenceScore: 0.9,
      riskLevel: 'low',
      expansionStage: 'expanded',
      featureWeights: dummyWeights,
      recommendedAction: 'quota_expansion',
      evaluatedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const res = await enforceLtvBudgetConstraints(mockDb, {
      customerId: 'cust_ok',
      requestedCostCents: 200,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.allowed).toBe(true);
      expect(res.value.ltvScore).toBe(500000);
    }
  });
});
