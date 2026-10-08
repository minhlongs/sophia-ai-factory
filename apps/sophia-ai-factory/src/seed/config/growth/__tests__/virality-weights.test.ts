import { describe, it, expect } from 'vitest';
import {
  VIRALITY_WEIGHTS,
  COMPUTE_ARBITRAGE_CONFIG,
  validateWeightVector,
} from '../virality-weights';

describe('virality-weights config (Seed Layer)', () => {
  describe('TikTok Weights', () => {
    it('should have exact specified weights for TikTok', () => {
      const tiktok = VIRALITY_WEIGHTS.TIKTOK;
      expect(tiktok.completion).toBe(0.35);
      expect(tiktok.rewatch).toBe(0.30);
      expect(tiktok.share).toBe(0.25);
      expect(tiktok.retentionAt3s).toBe(0.10);
    });

    it('should sum up to exactly 1.0 within tolerance', () => {
      expect(validateWeightVector(VIRALITY_WEIGHTS.TIKTOK)).toBe(true);
      const sum =
        VIRALITY_WEIGHTS.TIKTOK.completion +
        VIRALITY_WEIGHTS.TIKTOK.rewatch +
        VIRALITY_WEIGHTS.TIKTOK.share +
        VIRALITY_WEIGHTS.TIKTOK.retentionAt3s;
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
    });
  });

  describe('YouTube Shorts Weights', () => {
    it('should have exact specified weights for YouTube Shorts', () => {
      const yt = VIRALITY_WEIGHTS.YOUTUBE_SHORTS;
      expect(yt.viewedVsSwiped).toBe(0.45);
      expect(yt.completionRate).toBe(0.35);
      expect(yt.engagementLikes).toBe(0.10);
      expect(yt.subscriptionGain).toBe(0.10);
    });

    it('should sum up to exactly 1.0 within tolerance', () => {
      expect(validateWeightVector(VIRALITY_WEIGHTS.YOUTUBE_SHORTS)).toBe(true);
      const sum =
        VIRALITY_WEIGHTS.YOUTUBE_SHORTS.viewedVsSwiped +
        VIRALITY_WEIGHTS.YOUTUBE_SHORTS.completionRate +
        VIRALITY_WEIGHTS.YOUTUBE_SHORTS.engagementLikes +
        VIRALITY_WEIGHTS.YOUTUBE_SHORTS.subscriptionGain;
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
    });
  });

  describe('Instagram Reels Weights', () => {
    it('should have exact specified weights for Instagram Reels', () => {
      const ig = VIRALITY_WEIGHTS.INSTAGRAM_REELS;
      expect(ig.dmShare).toBe(0.40);
      expect(ig.save).toBe(0.30);
      expect(ig.completionRate).toBe(0.20);
      expect(ig.comments).toBe(0.10);
    });

    it('should sum up to exactly 1.0 within tolerance', () => {
      expect(validateWeightVector(VIRALITY_WEIGHTS.INSTAGRAM_REELS)).toBe(true);
      const sum =
        VIRALITY_WEIGHTS.INSTAGRAM_REELS.dmShare +
        VIRALITY_WEIGHTS.INSTAGRAM_REELS.save +
        VIRALITY_WEIGHTS.INSTAGRAM_REELS.completionRate +
        VIRALITY_WEIGHTS.INSTAGRAM_REELS.comments;
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
    });
  });

  describe('validateWeightVector helper', () => {
    it('should reject invalid weight vectors', () => {
      expect(validateWeightVector({ a: 0.5, b: 0.2 })).toBe(false);
      expect(validateWeightVector({ a: 0.8, b: 0.8 })).toBe(false);
    });
  });

  describe('Compute Arbitrage Config', () => {
    it('should specify sensible compute optimization boundaries', () => {
      expect(COMPUTE_ARBITRAGE_CONFIG.OFF_PEAK_DISCOUNT_RATIO).toBe(0.40);
      expect(COMPUTE_ARBITRAGE_CONFIG.HIGH_VELOCITY_THRESHOLD_SCORE).toBe(80.0);
      expect(COMPUTE_ARBITRAGE_CONFIG.LOW_VELOCITY_DEGRADATION_THRESHOLD).toBe(40.0);
      expect(COMPUTE_ARBITRAGE_CONFIG.DEFAULT_MAX_WAIT_OFF_PEAK_HOURS).toBe(6);
    });
  });
});
