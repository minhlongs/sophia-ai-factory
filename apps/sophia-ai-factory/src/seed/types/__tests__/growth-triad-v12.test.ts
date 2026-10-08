/**
 * Unit Tests for Growth Triad v12 Type Schemas
 * Layer: seed/types/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect } from 'vitest';
import {
  videoRetentionProfileSchema,
  channelBaselineMetricsSchema,
  reseedTriggerPayloadSchema,
  incomingConversionWebhookSchema,
} from '../growth-triad-v12';

describe('Growth Triad v12 Zod Validation Schemas', () => {
  it('validates a correct video retention profile', () => {
    const valid = {
      jobId: 'job_123',
      channelId: 'chan_yt_1',
      platform: 'YOUTUBE_SHORTS',
      avgRetentionPercent: 88.5,
      completionRatePercent: 62.0,
      views: 12500,
      durationSeconds: 45,
    };
    expect(videoRetentionProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid retention percentages', () => {
    const invalid = {
      jobId: 'job_123',
      channelId: 'chan_yt_1',
      platform: 'YOUTUBE_SHORTS',
      avgRetentionPercent: -10, // negative
      completionRatePercent: 120, // > 100
      views: 100,
      durationSeconds: 30,
    };
    expect(videoRetentionProfileSchema.safeParse(invalid).success).toBe(false);
  });

  it('validates a reseed trigger payload with mutated hooks', () => {
    const valid = {
      userId: 'usr_ceo_1',
      sourceJobId: 'job_viral_1',
      channelId: 'chan_tk_1',
      platform: 'TIKTOK_V2',
      originalHook: 'Top 3 AI tools for CEOs',
      retentionZScore: 2.15,
      classification: 'ALPHA_VIRAL',
      mutatedHooks: [
        '3 secret AI tools millionaires use',
        'Stop doing manual work: 3 AI tools',
      ],
    };
    expect(reseedTriggerPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('validates an incoming conversion webhook payload', () => {
    const valid = {
      network: 'CLICKBANK',
      externalOrderId: 'cb_order_998',
      videoManifestId: 'mnf_viral_99',
      userId: 'usr_ceo_1',
      grossAmountUsd: 149.0,
      commissionAmountUsd: 74.5,
      currency: 'USD',
    };
    expect(incomingConversionWebhookSchema.safeParse(valid).success).toBe(true);
  });
});
