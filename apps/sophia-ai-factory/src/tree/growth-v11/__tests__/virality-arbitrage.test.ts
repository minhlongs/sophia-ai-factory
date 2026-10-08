import { describe, it, expect } from 'vitest';
import {
  calculatePlatformViralityScore,
  calculateHookDivergence,
  mutatePlatformHook,
  normalizePlatform,
  DEFAULT_VIRALITY_WEIGHTS,
} from '../virality-arbitrage';

describe('Virality Arbitrage Engine', () => {
  describe('normalizePlatform', () => {
    it('normalizes various platform casing and aliases correctly', () => {
      expect(normalizePlatform('tiktok')).toBe('TIKTOK');
      expect(normalizePlatform('TT')).toBe('TIKTOK');
      expect(normalizePlatform('youtube_shorts')).toBe('YOUTUBE_SHORTS');
      expect(normalizePlatform('yt-shorts')).toBe('YOUTUBE_SHORTS');
      expect(normalizePlatform('instagram_reels')).toBe('INSTAGRAM_REELS');
      expect(normalizePlatform('IG')).toBe('INSTAGRAM_REELS');
      expect(normalizePlatform('unknown-random')).toBe('TIKTOK');
    });
  });

  describe('calculatePlatformViralityScore', () => {
    it('calculates TikTok virality score with default weights', () => {
      const metrics = {
        completionRate: 0.8,
        rewatchRate: 0.5,
        shareRate: 0.2,
        commentRate: 0.1,
        likeRate: 0.3,
      };
      // TikTok weights: 0.35*0.8 + 0.30*0.5 + 0.20*0.2 + 0.10*0.1 + 0.05*0.3
      // = 0.28 + 0.15 + 0.04 + 0.01 + 0.015 = 0.495
      const score = calculatePlatformViralityScore('TIKTOK', metrics);
      expect(score).toBeCloseTo(0.495, 3);
    });

    it('calculates YouTube Shorts score based on viewed-vs-swiped rate', () => {
      const metrics = {
        viewedVsSwipedRate: 0.9,
        completionRate: 0.8,
        shareRate: 0.1,
        likeRate: 0.2,
      };
      // Shorts: 0.45*0.9 + 0.30*0.8 + 0.15*0.1 + 0.10*0.2
      // = 0.405 + 0.24 + 0.015 + 0.02 = 0.68
      const score = calculatePlatformViralityScore('YOUTUBE_SHORTS', metrics);
      expect(score).toBeCloseTo(0.68, 2);
    });

    it('calculates Instagram Reels score based on DM share & saves', () => {
      const metrics = {
        dmShareRate: 0.7,
        saveRate: 0.6,
        completionRate: 0.5,
        likeRate: 0.4,
      };
      // Reels: 0.40*0.7 + 0.30*0.6 + 0.20*0.5 + 0.10*0.4
      // = 0.28 + 0.18 + 0.10 + 0.04 = 0.60
      const score = calculatePlatformViralityScore('INSTAGRAM_REELS', metrics);
      expect(score).toBeCloseTo(0.60, 2);
    });

    it('supports custom weights override', () => {
      const metrics = {
        completionRate: 1.0,
        rewatchRate: 0.0,
      };
      const customWeights = {
        completionRate: 2.0,
        rewatchRate: 1.0,
      };
      // (2.0*1 + 1.0*0) / 3.0 = 0.6667
      const score = calculatePlatformViralityScore('TIKTOK', metrics, customWeights);
      expect(score).toBe(0.6667);
    });

    it('handles division by zero and zero weights safely', () => {
      expect(calculatePlatformViralityScore('TIKTOK', {}, { completionRate: 0 })).toBe(0);
      expect(calculatePlatformViralityScore('TIKTOK', { completionRate: 1 }, {})).toBeGreaterThan(0);
      // @ts-expect-error Testing invalid runtime input
      expect(calculatePlatformViralityScore('TIKTOK', null)).toBe(0);
    });

    it('clamps values between 0 and 1', () => {
      const metrics = {
        completionRate: 2.5, // > 1
        rewatchRate: -0.5, // < 0
      };
      const score = calculatePlatformViralityScore('TIKTOK', metrics, {
        completionRate: 1,
        rewatchRate: 1,
      });
      // (1*1 + 1*0) / 2 = 0.5
      expect(score).toBe(0.5);
    });
  });

  describe('calculateHookDivergence', () => {
    it('returns 0 when distributions are identical', () => {
      const tokensA = ['ai', 'automation', 'passive', 'income'];
      const tokensB = ['ai', 'automation', 'passive', 'income'];
      const divergence = calculateHookDivergence(tokensA, tokensB);
      expect(divergence).toBe(0);
    });

    it('returns high divergence for completely disjoint token distributions', () => {
      const tokensA = ['cat', 'kitten', 'meow'];
      const tokensB = ['crypto', 'bitcoin', 'blockchain'];
      const divergence = calculateHookDivergence(tokensA, tokensB);
      expect(divergence).toBe(1.0);
    });

    it('returns intermediate divergence for partially overlapping tokens', () => {
      const tokensA = ['make', 'money', 'online', 'fast'];
      const tokensB = ['make', 'money', 'offline', 'slow'];
      const divergence = calculateHookDivergence(tokensA, tokensB);
      expect(divergence).toBeGreaterThan(0);
      expect(divergence).toBeLessThan(1.0);
    });

    it('handles empty token lists with zero-division safety', () => {
      expect(calculateHookDivergence([], [])).toBe(0);
      expect(calculateHookDivergence(['test'], [])).toBe(1.0);
      expect(calculateHookDivergence([], ['test'])).toBe(1.0);
    });
  });

  describe('mutatePlatformHook', () => {
    it('mutates title and tags for TikTok platform', () => {
      const res = mutatePlatformHook('How I built an AI app', ['tech', 'startup'], 'TIKTOK');
      expect(res.mutatedTitle).toContain('POV: How I built an AI app');
      expect(res.mutatedTags).toContain('fyp');
      expect(res.mutatedTags).toContain('viral');
      expect(res.mutatedTags).toContain('tech');
      expect(res.hookStrategy).toContain('3s High-Pacing Cut');
      expect(res.targetPlatform).toBe('TIKTOK');
    });

    it('avoids duplicate prefix for TikTok if already present', () => {
      const res = mutatePlatformHook('POV: Secrets of rich CEOs', [], 'TIKTOK');
      expect(res.mutatedTitle).toBe('POV: Secrets of rich CEOs');
    });

    it('mutates title and tags for YouTube Shorts', () => {
      const res = mutatePlatformHook('Crazy Coding Trick', ['code'], 'YOUTUBE_SHORTS');
      expect(res.mutatedTitle).toContain('[Watch Till End]');
      expect(res.mutatedTags).toContain('shorts');
      expect(res.mutatedTags).toContain('trendingshorts');
      expect(res.hookStrategy).toContain('Looping Audio');
      expect(res.targetPlatform).toBe('YOUTUBE_SHORTS');
    });

    it('mutates title and tags for Instagram Reels', () => {
      const res = mutatePlatformHook('Save this for later', ['marketing'], 'INSTAGRAM_REELS');
      expect(res.mutatedTitle).toContain('Send this to someone: Save this for later');
      expect(res.mutatedTags).toContain('reels');
      expect(res.mutatedTags).toContain('explorepage');
      expect(res.hookStrategy).toContain('Send to a friend');
      expect(res.targetPlatform).toBe('INSTAGRAM_REELS');
    });

    it('handles empty titles and cleans leading hash symbols from tags', () => {
      const res = mutatePlatformHook('', ['#growth', '##viral'], 'TIKTOK');
      expect(res.mutatedTitle).toBe('POV: Untitled Viral Short');
      expect(res.mutatedTags).toContain('growth');
      expect(res.mutatedTags).toContain('viral');
    });
  });
});
