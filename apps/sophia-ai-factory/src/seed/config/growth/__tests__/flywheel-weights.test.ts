/**
 * Unit Tests for Flywheel Config & Weights
 * Layer: seed/config/growth/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect } from 'vitest';
import { FLYWHEEL_CONFIG } from '../flywheel-weights';

describe('FLYWHEEL_CONFIG validation', () => {
  it('defines valid statistical threshold boundaries', () => {
    expect(FLYWHEEL_CONFIG.Z_SCORE_ALPHA_VIRAL_THRESHOLD).toBeGreaterThan(0);
    expect(FLYWHEEL_CONFIG.Z_SCORE_STAGNANT_THRESHOLD).toBeLessThan(0);
    expect(FLYWHEEL_CONFIG.MIN_SAMPLE_VIEWS_FOR_ZSCORE).toBeGreaterThanOrEqual(100);
  });

  it('contains baselines for all 3 supported social platforms', () => {
    expect(FLYWHEEL_CONFIG.DEFAULT_CHANNEL_BASELINES.YOUTUBE_SHORTS.meanRetention).toBe(65.0);
    expect(FLYWHEEL_CONFIG.DEFAULT_CHANNEL_BASELINES.TIKTOK_V2.meanRetention).toBe(58.0);
    expect(FLYWHEEL_CONFIG.DEFAULT_CHANNEL_BASELINES.INSTAGRAM_REELS.meanRetention).toBe(52.0);
  });

  it('sets token refresh lead time to 2 hours', () => {
    expect(FLYWHEEL_CONFIG.TOKEN_REFRESH_LEAD_TIME_MS).toBe(7200000);
  });
});
