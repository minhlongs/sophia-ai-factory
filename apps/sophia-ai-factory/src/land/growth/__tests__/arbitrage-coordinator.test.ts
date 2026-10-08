import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculatePlatformViralityScore,
  generateHookAlignments,
  determineComputeArbitrage,
  calculateReachLift,
  evaluateAndCoordinateArbitrage,
  recalibratePlatforms,
  getArbitrageMetrics,
} from '../arbitrage-coordinator';
import { createServerClient } from '@/seed/db/client';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

describe('arbitrage-coordinator', () => {
  const mockDbRun = vi.fn();
  const mockDbFirst = vi.fn();
  const mockDbAll = vi.fn();

  const mockPrepare = vi.fn(() => ({
    bind: vi.fn(() => ({
      run: mockDbRun,
      first: mockDbFirst,
      all: mockDbAll,
    })),
    run: mockDbRun,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    (createServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prepare: mockPrepare,
    });
  });

  describe('calculatePlatformViralityScore', () => {
    it('calculates TikTok virality score with completion and rewatch rates', () => {
      const score = calculatePlatformViralityScore('TIKTOK', {
        platform: 'TIKTOK',
        completionRate: 0.8,
        rewatchRate: 0.4,
      });
      // 0.8 * 0.55 + 0.4 * 0.45 = 0.44 + 0.18 = 0.62
      expect(score).toBe(0.62);
    });

    it('calculates YouTube Shorts virality score with viewedVsSwiped and completion rates', () => {
      const score = calculatePlatformViralityScore('YOUTUBE_SHORTS', {
        platform: 'YOUTUBE_SHORTS',
        viewedVsSwipedRate: 0.9,
        completionRate: 0.7,
      });
      // 0.9 * 0.65 + 0.7 * 0.35 = 0.585 + 0.245 = 0.83
      expect(score).toBe(0.83);
    });

    it('calculates Instagram Reels virality score with DM shares and save rates', () => {
      const score = calculatePlatformViralityScore('INSTAGRAM_REELS', {
        platform: 'INSTAGRAM_REELS',
        dmShareRate: 0.75,
        saveRate: 0.5,
      });
      // 0.75 * 0.60 + 0.5 * 0.40 = 0.45 + 0.20 = 0.65
      expect(score).toBe(0.65);
    });

    it('uses defaults when metrics are omitted and caps at 1.0', () => {
      const score = calculatePlatformViralityScore('TIKTOK', { platform: 'TIKTOK' });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('generateHookAlignments', () => {
    it('generates hook alignment specifications across all 3 platforms', () => {
      const alignments = generateHookAlignments('Stop doing AI video generation wrong', {
        TIKTOK: 0.85,
        YOUTUBE_SHORTS: 0.92,
        INSTAGRAM_REELS: 0.65,
      });

      expect(alignments).toHaveLength(3);
      expect(alignments[0]?.platform).toBe('TIKTOK');
      expect(alignments[0]?.status).toBe('OPTIMIZED');
      expect(alignments[0]?.divergenceJsd).toBe(0.142);

      expect(alignments[1]?.platform).toBe('YOUTUBE_SHORTS');
      expect(alignments[1]?.status).toBe('OPTIMIZED');

      expect(alignments[2]?.platform).toBe('INSTAGRAM_REELS');
      expect(alignments[2]?.status).toBe('QUEUED');
    });
  });

  describe('determineComputeArbitrage', () => {
    it('routes high-velocity videos to Realtime Photoreal model', () => {
      const decision = determineComputeArbitrage(0.88, 'NORMAL', 2.0);
      expect(decision.regime).toBe('REALTIME_PHOTOREAL');
      expect(decision.targetProvider).toBe('HeyGen Photoreal');
      expect(decision.estimatedCostSavingsUsd).toBe(0.0);
    });

    it('forces Realtime Photoreal when urgency is HIGH', () => {
      const decision = determineComputeArbitrage(0.4, 'HIGH', 2.0);
      expect(decision.regime).toBe('REALTIME_PHOTOREAL');
    });

    it('routes non-urgent batch to Off-Peak Queue with significant savings', () => {
      const decision = determineComputeArbitrage(0.5, 'LOW', 2.0);
      expect(decision.regime).toBe('OFF_PEAK_QUEUE');
      expect(decision.targetProvider).toBe('Off-Peak Batch Worker');
      expect(decision.estimatedCostSavingsUsd).toBe(0.84);
    });

    it('routes average virality videos to Express Degraded model', () => {
      const decision = determineComputeArbitrage(0.7, 'NORMAL', 2.0);
      expect(decision.regime).toBe('EXPRESS_DEGRADED');
      expect(decision.targetProvider).toBe('D-ID Express');
      expect(decision.estimatedCostSavingsUsd).toBe(0.5);
    });
  });

  describe('calculateReachLift', () => {
    it('computes baseline and compounded syndicated reach multiplier', () => {
      const { baselineReach, syndicatedReach, reachLiftMultiplier } = calculateReachLift({
        TIKTOK: 0.8,
        YOUTUBE_SHORTS: 0.8,
        INSTAGRAM_REELS: 0.8,
      });

      expect(baselineReach).toBe(8000);
      expect(syndicatedReach).toBe(10784);
      expect(reachLiftMultiplier).toBe(1.348);
    });
  });

  describe('evaluateAndCoordinateArbitrage', () => {
    it('successfully coordinates virality evaluation and persists to D1', async () => {
      mockDbRun.mockResolvedValue({ success: true });

      const result = await evaluateAndCoordinateArbitrage({
        tenantId: 'tenant-1',
        userId: 'user-1',
        videoId: 'video-101',
        videoHook: 'Here is how to generate 100 faceless videos in 5 minutes',
        urgency: 'HIGH',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.videoId).toBe('video-101');
        expect(result.value.tenantId).toBe('tenant-1');
        expect(result.value.computeDecision.regime).toBe('REALTIME_PHOTOREAL');
        expect(result.value.hookAlignments).toHaveLength(3);
        expect(result.value.shadowbanAvoidanceRate).toBe(0.998);
        expect(result.value.reachLiftMultiplier).toBeGreaterThan(1.0);
      }
    });

    it('handles D1 error gracefully without crashing evaluation', async () => {
      mockDbRun.mockRejectedValueOnce(new Error('D1 table write timeout'));

      const result = await evaluateAndCoordinateArbitrage({
        tenantId: 'tenant-1',
        userId: 'user-1',
        videoId: 'video-102',
        videoHook: 'Another hook',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.videoId).toBe('video-102');
      }
    });
  });

  describe('recalibratePlatforms', () => {
    it('returns recalibration status for all 3 supported platforms', async () => {
      const result = await recalibratePlatforms('tenant-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.recalibratedCount).toBe(3);
        expect(result.value.platforms).toEqual(['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS']);
        expect(result.value.globalReachLift).toBe(1.348);
      }
    });
  });

  describe('getArbitrageMetrics', () => {
    it('returns aggregated metrics when DB returns data', async () => {
      mockDbFirst.mockResolvedValueOnce({
        avg_lift: 1.42,
        total_savings: 512.4,
      });

      const result = await getArbitrageMetrics('tenant-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.reachLiftPercentage).toBe(42.0);
        expect(result.value.totalComputeSavingsUsd).toBe(512.4);
        expect(result.value.platformMatrix).toHaveLength(3);
        expect(result.value.activeHookDivergenceJsd).toBe(0.142);
      }
    });

    it('returns calibrated defaults when DB table has nulls or throws', async () => {
      mockDbFirst.mockRejectedValueOnce(new Error('No table'));

      const result = await getArbitrageMetrics('tenant-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.reachLiftPercentage).toBe(34.8);
        expect(result.value.totalComputeSavingsUsd).toBe(418.5);
      }
    });
  });
});
