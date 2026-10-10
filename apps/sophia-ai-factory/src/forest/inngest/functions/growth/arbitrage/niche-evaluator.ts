/**
 * @file niche-evaluator.ts
 * @description Evaluates platform virality metrics, hook mutations, and syndication scoring
 */

import {
  calculatePlatformViralityScore,
  calculateHookDivergence,
  mutatePlatformHook,
  type ViralityMetrics,
} from '@/tree/growth-v11/virality-arbitrage';
import type {
  SupportedPlatform,
  PlatformMetricProfile,
  PlatformArbitrageScore,
  HookMutationRequest,
  ArbitrageRecommendation,
} from '@/seed/types/growth-triad-v11';
import type { ViralityEvaluationResult } from './types';

export function extractMetricsForPlatform(
  platform: SupportedPlatform,
  profile: PlatformMetricProfile,
): ViralityMetrics {
  switch (platform) {
    case 'TIKTOK':
      return {
        completionRate: profile.tiktok?.completionRate ?? 0.6,
        rewatchRate: profile.tiktok?.rewatchRate ?? 0.2,
        shareRate: profile.tiktok?.shareRate ?? 0.1,
        retentionAt3s: profile.tiktok?.retentionAt3s ?? 0.7,
        likeRate: profile.tiktok?.likeRate ?? 0.05,
        commentRate: profile.tiktok?.commentRate ?? 0.02,
      };
    case 'YOUTUBE_SHORTS':
      return {
        viewedVsSwipedRate: profile.youtubeShorts?.viewedVsSwipedRate ?? 0.75,
        completionRate: profile.youtubeShorts?.completionRate ?? 0.65,
        likeRate: profile.youtubeShorts?.engagementLikes ?? 0.05,
      };
    case 'INSTAGRAM_REELS':
      return {
        dmShareRate: profile.instagramReels?.directMessageShareRate ?? 0.15,
        saveRate: profile.instagramReels?.saveRate ?? 0.1,
        completionRate: profile.instagramReels?.completionRate ?? 0.55,
        likeRate: profile.instagramReels?.likeRate ?? 0.05,
      };
    default:
      return {};
  }
}

export function evaluateViralityAndHooks(params: {
  videoId: string;
  primaryPlatform: SupportedPlatform;
  targetPlatforms: SupportedPlatform[];
  metrics: PlatformMetricProfile;
  originalHookText: string;
}): ViralityEvaluationResult {
  const { videoId, primaryPlatform, targetPlatforms, metrics, originalHookText } = params;

  const primaryMetrics = extractMetricsForPlatform(primaryPlatform, metrics);
  const primaryRawScore = calculatePlatformViralityScore(primaryPlatform, primaryMetrics);
  const primaryScorePercent = Math.min(100, Math.round(primaryRawScore * 100));

  const syndicationRecommendations: PlatformArbitrageScore[] = [];
  for (const destPlatform of targetPlatforms || []) {
    if (destPlatform !== primaryPlatform) {
      const destMetrics = extractMetricsForPlatform(destPlatform, metrics);
      const rawScore = calculatePlatformViralityScore(destPlatform, destMetrics);
      const scorePercent = Math.min(100, Math.round(rawScore * 100));
      const expectedMultiplier = Number((rawScore / Math.max(0.1, primaryRawScore)).toFixed(2));
      const recommendation: ArbitrageRecommendation =
        scorePercent >= 70 ? 'SYNDICATE' : scorePercent >= 40 ? 'HOLD' : 'SKIP';

      syndicationRecommendations.push({
        platform: destPlatform,
        viralityScore: scorePercent,
        expectedMultiplier: Math.max(0.1, expectedMultiplier),
        confidenceScore: 0.88,
        retentionIndex: Math.min(100, Math.round(scorePercent * 0.95)),
        engagementIndex: Math.min(100, Math.round(scorePercent * 1.05)),
        recommendation,
        reasoning: `Predicted ${destPlatform} multiplier ${expectedMultiplier}x relative to primary ${primaryPlatform}.`,
      });
    }
  }

  const hookMutations: HookMutationRequest[] = [];
  const sourceTokens = originalHookText.split(/\s+/);
  for (const destPlatform of targetPlatforms || []) {
    if (destPlatform !== primaryPlatform) {
      const mutation = mutatePlatformHook(originalHookText, [], destPlatform);
      const targetTokens = mutation.mutatedTitle.split(/\s+/);
      const divergence = calculateHookDivergence(sourceTokens, targetTokens);
      hookMutations.push({
        mutationId: `mut_${Date.now()}_${destPlatform.toLowerCase()}`,
        videoId,
        sourcePlatform: primaryPlatform,
        targetPlatform: destPlatform,
        originalHookText,
        mutatedHookText: mutation.mutatedTitle,
        divergenceScore: divergence,
        strategy: 'CURIOSITY_PUNCH',
        metadataTransform: {
          removeWatermarkMarkers: true,
          stripExifMetadata: true,
          normalizeAudioLufs: -14.0,
          targetPacingWpm: 185,
        },
      });
    }
  }

  return {
    primaryScore: primaryScorePercent,
    syndicationRecommendations,
    hookMutations,
  };
}
