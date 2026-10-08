/**
 * Unit Tests for Affiliate Conversion Matcher
 * Layer: tree/growth-v12/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect } from 'vitest';
import { matchConversionToManifest, type MatchCandidateManifest } from '../affiliate-matcher';
import type { AffiliateConversionWebhook } from '@/seed/types/growth-triad-v12';

describe('matchConversionToManifest', () => {
  const candidates: MatchCandidateManifest[] = [
    {
      manifestId: 'manifest_vid_101',
      channelId: 'chan_yt_1',
      trackingSubId: 'sub_101',
      utmCampaign: 'ai_tools_spring',
    },
    {
      manifestId: 'manifest_vid_102',
      channelId: 'chan_yt_2',
      trackingSubId: 'sub_102',
    },
  ];

  it('matches exact subId candidate with 1.0 confidence', () => {
    const webhook: AffiliateConversionWebhook = {
      affiliateNetwork: 'CLICKBANK',
      externalOrderId: 'CB_ORDER_999',
      grossAmountUsd: 120.0,
      commissionAmountUsd: 60.0,
      currency: 'USD',
      subId: 'sub_101',
    };

    const res = matchConversionToManifest(webhook, candidates);
    expect(res.isMatched).toBe(true);
    expect(res.videoManifestId).toBe('manifest_vid_101');
    expect(res.confidenceScore).toBe(1.0);
    expect(res.commissionAmountUsd).toBe(60.0);
  });

  it('matches embedded manifest_id in rawPayload with 0.85 confidence', () => {
    const webhook: AffiliateConversionWebhook = {
      affiliateNetwork: 'PAYOS',
      externalOrderId: 'POS_ORD_444',
      grossAmountUsd: 50.0,
      commissionAmountUsd: 15.0,
      currency: 'USD',
      rawPayload: JSON.stringify({ manifest_id: 'manifest_vid_102' }),
    };

    const res = matchConversionToManifest(webhook, candidates);
    expect(res.isMatched).toBe(true);
    expect(res.videoManifestId).toBe('manifest_vid_102');
    expect(res.confidenceScore).toBe(0.85);
  });

  it('returns unmatched result when no candidates correspond', () => {
    const webhook: AffiliateConversionWebhook = {
      affiliateNetwork: 'NOWPAYMENTS',
      externalOrderId: 'NP_ORD_000',
      grossAmountUsd: 30.0,
      commissionAmountUsd: 10.0,
      currency: 'USD',
      subId: 'unmatched_code',
    };

    const res = matchConversionToManifest(webhook, candidates);
    expect(res.isMatched).toBe(false);
    expect(res.videoManifestId).toBe('');
    expect(res.confidenceScore).toBe(0);
  });
});
