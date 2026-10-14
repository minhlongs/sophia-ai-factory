import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCustomerPredictiveScoreAction,
  evaluateCustomerPredictiveMetricsAction,
  getActiveRecommendationsAction,
  applyExpansionRecommendationAction,
  generateInvestorRelationsForecastAction,
} from '../predictive-dashboard-actions';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/tree/predictive/predictive-ltv-engine', () => ({
  calculatePredictiveScore: vi.fn(),
  evaluatePredictiveMetrics: vi.fn(),
  generateExpansionRecommendations: vi.fn(),
  simulatePortfolioLtvForecast: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';

describe('Predictive Dashboard Actions Facade', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated user for getCustomerPredictiveScoreAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getCustomerPredictiveScoreAction('cust-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNAUTHORIZED: Authentication required');
  });

  it('rejects unauthenticated user for evaluateCustomerPredictiveMetricsAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await evaluateCustomerPredictiveMetricsAction({
      customerId: 'cust-1',
      currentTier: 'ENTERPRISE',
      tenureDays: 180,
      currentMrrCents: 50000,
      usedMcuMonthly: 800,
      quotaMcuMonthly: 1000,
      videoGenerationsLast7d: 50,
      videoGenerationsPrev30d: 200,
      activeLoginsLast14d: 12,
      apiRequestsCount: 1500,
      apiErrorsCount: 2,
      activeAgentsCount: 4,
      featuresUsedCount: 7,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNAUTHORIZED: Authentication required');
  });

  it('rejects unauthenticated user for getActiveRecommendationsAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await getActiveRecommendationsAction('cust-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNAUTHORIZED: Authentication required');
  });

  it('rejects unauthenticated user for applyExpansionRecommendationAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await applyExpansionRecommendationAction('rec-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNAUTHORIZED: Authentication required');
  });

  it('rejects unauthenticated user for generateInvestorRelationsForecastAction', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await generateInvestorRelationsForecastAction({
      startingMrrCents: 1000000,
      startingCustomersCount: 500,
      iterations: 100,
      horizonMonths: 12,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNAUTHORIZED: Authentication required');
  });
});
