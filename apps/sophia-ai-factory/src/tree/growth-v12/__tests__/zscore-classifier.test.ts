/**
 * Unit Tests for Z-Score Retention Classifier
 * Layer: tree/growth-v12/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect } from 'vitest';
import { classifyVideoRetention } from '../zscore-classifier';
import type { VideoRetentionProfile } from '@/seed/types/growth-triad-v12';

describe('classifyVideoRetention', () => {
  const baseProfile: VideoRetentionProfile = {
    jobId: 'job_sample_1',
    channelId: 'chan_yt_1',
    platform: 'YOUTUBE_SHORTS',
    avgRetentionPercent: 86.0,
    completionRatePercent: 70.0,
    views: 3500,
    durationSeconds: 30,
  };

  it('classifies high-retention video as ALPHA_VIRAL and eligible for reseed', () => {
    // Mean is 65.0, stdDev is 12.0. Z = (86 - 65) / 12 = 1.75 >= 1.5
    const res = classifyVideoRetention(baseProfile);
    expect(res.classification).toBe('ALPHA_VIRAL');
    expect(res.zScore).toBe(1.75);
    expect(res.isEligibleForReseed).toBe(true);
    expect(res.confidence).toBe('HIGH');
  });

  it('marks low-sample view count as LOW confidence and ineligible for reseed', () => {
    const lowViewProfile = { ...baseProfile, views: 150 };
    const res = classifyVideoRetention(lowViewProfile);
    expect(res.classification).toBe('ALPHA_VIRAL');
    expect(res.confidence).toBe('LOW');
    expect(res.isEligibleForReseed).toBe(false);
  });

  it('classifies poor retention as STAGNANT', () => {
    // Z = (55 - 65) / 12 = -0.83 < -0.5
    const poorProfile = { ...baseProfile, avgRetentionPercent: 55.0 };
    const res = classifyVideoRetention(poorProfile);
    expect(res.classification).toBe('STAGNANT');
    expect(res.zScore).toBe(-0.83);
    expect(res.isEligibleForReseed).toBe(false);
  });
});
