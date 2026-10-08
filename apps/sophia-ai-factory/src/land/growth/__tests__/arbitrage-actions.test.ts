import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeArbitrageAction,
  recalibrateAllPlatformsAction,
  getArbitrageDashboardMetricsAction,
} from '../arbitrage-actions';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  evaluateAndCoordinateArbitrage,
  recalibratePlatforms,
  getArbitrageMetrics,
} from '../arbitrage-coordinator';
import { success } from '@/seed/types/result';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('../arbitrage-coordinator', () => ({
  evaluateAndCoordinateArbitrage: vi.fn(),
  recalibratePlatforms: vi.fn(),
  getArbitrageMetrics: vi.fn(),
}));

describe('arbitrage-actions', () => {
  const mockUser = {
    id: 'user-auth-123',
    email: 'ceo@agencyos.network',
    role: 'admin',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeArbitrageAction', () => {
    it('returns unauthorized error if user session is not present', async () => {
      (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const result = await executeArbitrageAction({
        videoId: 'vid-1',
        videoHook: 'Valid video hook line',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Unauthorized');
      }
      expect(evaluateAndCoordinateArbitrage).not.toHaveBeenCalled();
    });

    it('returns validation error if input does not satisfy schema', async () => {
      (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockUser);

      const result = await executeArbitrageAction({
        videoId: '',
        videoHook: 'ab', // less than 3 chars
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Validation Error');
      }
      expect(evaluateAndCoordinateArbitrage).not.toHaveBeenCalled();
    });

    it('delegates to evaluateAndCoordinateArbitrage with authenticated user and valid inputs', async () => {
      (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockUser);
      const mockEvalResult = {
        logId: 'arb_123',
        videoId: 'vid-1',
        tenantId: mockUser.id,
        timestamp: Date.now(),
        platformScores: { TIKTOK: 0.85, YOUTUBE_SHORTS: 0.91, INSTAGRAM_REELS: 0.77 },
        hookAlignments: [],
        computeDecision: {
          regime: 'REALTIME_PHOTOREAL' as const,
          targetProvider: 'HeyGen Photoreal',
          estimatedCostSavingsUsd: 0,
          reason: 'High virality',
        },
        baselineReach: 8000,
        syndicatedReach: 10784,
        reachLiftMultiplier: 1.348,
        shadowbanAvoidanceRate: 0.998,
      };

      (evaluateAndCoordinateArbitrage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        success(mockEvalResult)
      );

      const result = await executeArbitrageAction({
        videoId: 'vid-1',
        videoHook: 'How to scale SaaS to 10k MRR',
        urgency: 'HIGH',
        estimatedTokenCostUsd: 2.5,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.logId).toBe('arb_123');
        expect(result.value.reachLiftMultiplier).toBe(1.348);
      }

      expect(evaluateAndCoordinateArbitrage).toHaveBeenCalledWith({
        tenantId: mockUser.id,
        userId: mockUser.id,
        videoId: 'vid-1',
        videoHook: 'How to scale SaaS to 10k MRR',
        urgency: 'HIGH',
        estimatedTokenCostUsd: 2.5,
        metrics: undefined,
      });
    });
  });

  describe('recalibrateAllPlatformsAction', () => {
    it('returns unauthorized if no session is active', async () => {
      (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const result = await recalibrateAllPlatformsAction();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Unauthorized');
      }
      expect(recalibratePlatforms).not.toHaveBeenCalled();
    });

    it('invokes recalibratePlatforms for authenticated user', async () => {
      (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockUser);
      (recalibratePlatforms as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        success({
          recalibratedCount: 3,
          platforms: ['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS'],
          globalReachLift: 1.348,
        })
      );

      const result = await recalibrateAllPlatformsAction();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.recalibratedCount).toBe(3);
        expect(result.value.platforms).toContain('TIKTOK');
      }
      expect(recalibratePlatforms).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getArbitrageDashboardMetricsAction', () => {
    it('returns unauthorized if no session is active', async () => {
      (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const result = await getArbitrageDashboardMetricsAction();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Unauthorized');
      }
      expect(getArbitrageMetrics).not.toHaveBeenCalled();
    });

    it('returns dashboard metrics for authenticated user', async () => {
      (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockUser);
      (getArbitrageMetrics as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        success({
          reachLiftPercentage: 34.8,
          totalComputeSavingsUsd: 418.5,
          activeHookDivergenceJsd: 0.142,
          shadowbanAvoidanceRate: 0.998,
          platformMatrix: [],
          computeRegime: 'OFF_PEAK_QUEUE' as const,
        })
      );

      const result = await getArbitrageDashboardMetricsAction();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.reachLiftPercentage).toBe(34.8);
        expect(result.value.totalComputeSavingsUsd).toBe(418.5);
      }
      expect(getArbitrageMetrics).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
