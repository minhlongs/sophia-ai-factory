import { describe, it, expect } from 'vitest';
import {
  SupportedPlatformSchema,
  SophiaTierSchema,
  TikTokMetricsSchema,
  YouTubeShortsMetricsSchema,
  InstagramReelsMetricsSchema,
  PlatformMetricProfileSchema,
  PlatformArbitrageScoreSchema,
  HookMutationRequestSchema,
  ComputeJobArbitrageSpecSchema,
  ArbitrageDecisionSchema,
  type PlatformMetricProfile,
  type PlatformArbitrageScore,
  type HookMutationRequest,
  type ComputeJobArbitrageSpec,
  type ArbitrageDecision,
} from '../growth-triad-v11';

describe('growth-triad-v11 types and Zod schemas (Seed Layer)', () => {
  describe('SupportedPlatformSchema', () => {
    it('accepts valid platforms', () => {
      expect(SupportedPlatformSchema.parse('TIKTOK')).toBe('TIKTOK');
      expect(SupportedPlatformSchema.parse('YOUTUBE_SHORTS')).toBe('YOUTUBE_SHORTS');
      expect(SupportedPlatformSchema.parse('INSTAGRAM_REELS')).toBe('INSTAGRAM_REELS');
    });

    it('rejects unsupported platforms', () => {
      expect(() => SupportedPlatformSchema.parse('TWITTER')).toThrow();
      expect(() => SupportedPlatformSchema.parse('FACEBOOK')).toThrow();
    });
  });

  describe('SophiaTierSchema', () => {
    it('accepts uppercase Sophia tiers', () => {
      expect(SophiaTierSchema.parse('BASIC')).toBe('BASIC');
      expect(SophiaTierSchema.parse('PREMIUM')).toBe('PREMIUM');
      expect(SophiaTierSchema.parse('ENTERPRISE')).toBe('ENTERPRISE');
      expect(SophiaTierSchema.parse('MASTER')).toBe('MASTER');
    });

    it('rejects lowercase tiers', () => {
      expect(() => SophiaTierSchema.parse('basic')).toThrow();
      expect(() => SophiaTierSchema.parse('premium')).toThrow();
    });
  });

  describe('PlatformMetricProfileSchema', () => {
    it('validates a complete multi-platform profile successfully', () => {
      const profile: PlatformMetricProfile = {
        videoId: 'vid_123',
        tiktok: {
          completionRate: 0.72,
          rewatchRate: 0.45,
          shareRate: 0.18,
          retentionAt3s: 0.88,
          likeRate: 0.12,
          commentRate: 0.04,
        },
        youtubeShorts: {
          viewedVsSwipedRate: 0.81,
          completionRate: 0.69,
          engagementLikes: 0.08,
          subscriptionGainRate: 0.02,
          averagePercentageViewed: 1.15,
        },
        instagramReels: {
          directMessageShareRate: 0.22,
          saveRate: 0.15,
          completionRate: 0.64,
          commentRate: 0.03,
          likeRate: 0.09,
        },
        observedViews: 54000,
        collectedAt: 1728390000,
      };

      const parsed = PlatformMetricProfileSchema.parse(profile);
      expect(parsed.videoId).toBe('vid_123');
      expect(parsed.tiktok?.completionRate).toBe(0.72);
      expect(parsed.youtubeShorts?.viewedVsSwipedRate).toBe(0.81);
      expect(parsed.instagramReels?.directMessageShareRate).toBe(0.22);
    });

    it('fails when rates are out of bounds [0, 1]', () => {
      expect(() =>
        TikTokMetricsSchema.parse({
          completionRate: 1.25, // invalid > 1
          rewatchRate: 0.5,
          shareRate: 0.2,
          retentionAt3s: 0.8,
        })
      ).toThrow();

      expect(() =>
        YouTubeShortsMetricsSchema.parse({
          viewedVsSwipedRate: -0.1, // invalid < 0
          completionRate: 0.5,
        })
      ).toThrow();

      expect(() =>
        InstagramReelsMetricsSchema.parse({
          directMessageShareRate: 0.3,
          saveRate: 1.05, // invalid > 1
          completionRate: 0.6,
        })
      ).toThrow();
    });
  });

  describe('PlatformArbitrageScoreSchema', () => {
    it('validates high-confidence arbitrage score successfully', () => {
      const score: PlatformArbitrageScore = {
        platform: 'TIKTOK',
        viralityScore: 92.5,
        expectedMultiplier: 3.4,
        confidenceScore: 0.88,
        retentionIndex: 94.0,
        engagementIndex: 89.2,
        recommendation: 'PRIMARY_TARGET',
        reasoning: 'Exceptional rewatch and 3s retention signals indicate breakout potential',
      };

      const parsed = PlatformArbitrageScoreSchema.parse(score);
      expect(parsed.platform).toBe('TIKTOK');
      expect(parsed.viralityScore).toBe(92.5);
      expect(parsed.expectedMultiplier).toBe(3.4);
      expect(parsed.recommendation).toBe('PRIMARY_TARGET');
    });

    it('rejects scores exceeding boundaries', () => {
      expect(() =>
        PlatformArbitrageScoreSchema.parse({
          platform: 'TIKTOK',
          viralityScore: 105.0, // max is 100
          expectedMultiplier: 2.0,
          confidenceScore: 0.9,
          retentionIndex: 80,
          engagementIndex: 80,
          recommendation: 'PRIMARY_TARGET',
          reasoning: 'Out of bounds',
        })
      ).toThrow();
    });
  });

  describe('HookMutationRequestSchema', () => {
    it('validates a hook mutation request with metadata transformations', () => {
      const request: HookMutationRequest = {
        mutationId: 'mut_001',
        videoId: 'vid_123',
        sourcePlatform: 'TIKTOK',
        targetPlatform: 'YOUTUBE_SHORTS',
        originalHookText: 'Stop scrolling if you want to save 10 hours this week',
        mutatedHookText: 'Here is how top creators save 10 hours every single week:',
        divergenceScore: 0.42,
        strategy: 'DIRECT_VALUE',
        metadataTransform: {
          removeWatermarkMarkers: true,
          stripExifMetadata: true,
          normalizeAudioLufs: -14.0,
          targetPacingWpm: 195,
        },
      };

      const parsed = HookMutationRequestSchema.parse(request);
      expect(parsed.mutationId).toBe('mut_001');
      expect(parsed.strategy).toBe('DIRECT_VALUE');
      expect(parsed.metadataTransform.targetPacingWpm).toBe(195);
      expect(parsed.metadataTransform.removeWatermarkMarkers).toBe(true);
    });

    it('rejects pacing outside of [100, 300] WPM range', () => {
      expect(() =>
        HookMutationRequestSchema.parse({
          mutationId: 'mut_err',
          videoId: 'vid_123',
          sourcePlatform: 'TIKTOK',
          targetPlatform: 'YOUTUBE_SHORTS',
          originalHookText: 'Test hook',
          strategy: 'CURIOSITY_PUNCH',
          metadataTransform: {
            removeWatermarkMarkers: true,
            stripExifMetadata: true,
            normalizeAudioLufs: -14.0,
            targetPacingWpm: 450, // invalid > 300
          },
        })
      ).toThrow();
    });
  });

  describe('ComputeJobArbitrageSpecSchema', () => {
    it('validates opportunistic compute job arbitrage spec', () => {
      const spec: ComputeJobArbitrageSpec = {
        jobId: 'comp_job_88',
        videoId: 'vid_123',
        userTier: 'ENTERPRISE',
        velocityScore: 84.5,
        priority: 'IMMEDIATE_PREMIUM',
        targetModelTier: 'PHOTOREAL_EXPENSIVE',
        executionWindow: {
          earliestExecutionSec: 1728391000,
          latestExecutionSec: 1728394600,
          isOffPeak: false,
        },
        estimatedCostUsd: 1.45,
        estimatedSavingsUsd: 0.0,
        discountRatio: 0.0,
      };

      const parsed = ComputeJobArbitrageSpecSchema.parse(spec);
      expect(parsed.jobId).toBe('comp_job_88');
      expect(parsed.userTier).toBe('ENTERPRISE');
      expect(parsed.targetModelTier).toBe('PHOTOREAL_EXPENSIVE');
    });

    it('validates off-peak economy compute spec with 40% discount', () => {
      const spec: ComputeJobArbitrageSpec = {
        jobId: 'comp_job_89',
        videoId: 'vid_456',
        userTier: 'BASIC',
        velocityScore: 32.0,
        priority: 'OFF_PEAK_ECONOMIC',
        targetModelTier: 'ECONOMY_DEGRADED',
        executionWindow: {
          earliestExecutionSec: 1728400000,
          latestExecutionSec: 1728421600,
          isOffPeak: true,
        },
        estimatedCostUsd: 0.54,
        estimatedSavingsUsd: 0.36,
        discountRatio: 0.40,
      };

      const parsed = ComputeJobArbitrageSpecSchema.parse(spec);
      expect(parsed.priority).toBe('OFF_PEAK_ECONOMIC');
      expect(parsed.executionWindow.isOffPeak).toBe(true);
      expect(parsed.discountRatio).toBe(0.40);
    });
  });

  describe('ArbitrageDecisionSchema', () => {
    it('validates a complete arbitrage decision workflow object', () => {
      const decision: ArbitrageDecision = {
        decisionId: 'dec_999',
        videoId: 'vid_123',
        userId: 'usr_abc',
        primaryPlatform: 'TIKTOK',
        syndicationPlatforms: ['YOUTUBE_SHORTS', 'INSTAGRAM_REELS'],
        scores: {
          TIKTOK: {
            platform: 'TIKTOK',
            viralityScore: 91.0,
            expectedMultiplier: 3.2,
            confidenceScore: 0.89,
            retentionIndex: 92.0,
            engagementIndex: 88.0,
            recommendation: 'PRIMARY_TARGET',
            reasoning: 'Primary breakout vector',
          },
          YOUTUBE_SHORTS: {
            platform: 'YOUTUBE_SHORTS',
            viralityScore: 78.5,
            expectedMultiplier: 1.8,
            confidenceScore: 0.76,
            retentionIndex: 75.0,
            engagementIndex: 80.0,
            recommendation: 'SYNDICATE',
            reasoning: 'Good secondary reach with modified hook',
          },
          INSTAGRAM_REELS: {
            platform: 'INSTAGRAM_REELS',
            viralityScore: 71.0,
            expectedMultiplier: 1.4,
            confidenceScore: 0.72,
            retentionIndex: 70.0,
            engagementIndex: 72.0,
            recommendation: 'SYNDICATE',
            reasoning: 'Suitable for reel syndication',
          },
        },
        computeSpec: {
          jobId: 'job_101',
          videoId: 'vid_123',
          userTier: 'PREMIUM',
          velocityScore: 91.0,
          priority: 'IMMEDIATE_PREMIUM',
          targetModelTier: 'PHOTOREAL_EXPENSIVE',
          executionWindow: {
            earliestExecutionSec: 1728391000,
            latestExecutionSec: 1728395000,
            isOffPeak: false,
          },
          estimatedCostUsd: 1.20,
          estimatedSavingsUsd: 0.0,
          discountRatio: 0.0,
        },
        hookMutations: [
          {
            mutationId: 'mut_yt',
            videoId: 'vid_123',
            sourcePlatform: 'TIKTOK',
            targetPlatform: 'YOUTUBE_SHORTS',
            originalHookText: 'Do not ignore this AI hack',
            mutatedHookText: 'How 1 simple AI tool changed everything in 2026',
            divergenceScore: 0.45,
            strategy: 'SHOCK_REVEAL',
            metadataTransform: {
              removeWatermarkMarkers: true,
              stripExifMetadata: true,
              normalizeAudioLufs: -14.0,
              targetPacingWpm: 180,
            },
          },
        ],
        status: 'APPROVED',
        createdAt: 1728391000,
        updatedAt: 1728391000,
      };

      const parsed = ArbitrageDecisionSchema.parse(decision);
      expect(parsed.decisionId).toBe('dec_999');
      expect(parsed.primaryPlatform).toBe('TIKTOK');
      expect(parsed.syndicationPlatforms).toHaveLength(2);
      expect(parsed.scores.TIKTOK.recommendation).toBe('PRIMARY_TARGET');
      expect(parsed.status).toBe('APPROVED');
    });

    it('rejects invalid status', () => {
      expect(() =>
        ArbitrageDecisionSchema.parse({
          decisionId: 'dec_err',
          videoId: 'vid_err',
          userId: 'usr_err',
          primaryPlatform: 'TIKTOK',
          syndicationPlatforms: [],
          scores: {},
          computeSpec: {} as unknown as ComputeJobArbitrageSpec,
          hookMutations: [],
          status: 'UNKNOWN_STATUS',
        })
      ).toThrow();
    });
  });
});
