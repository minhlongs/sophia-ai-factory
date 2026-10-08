/**
 * @file smart-link-yield-engine.test.ts
 * @description Unit tests for Affiliate Smart-Link Yield Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculateExpectedYield,
  matchBestYieldOffer,
} from '../smart-link-yield-engine';
import type { AffiliateOffer } from '@/seed/types/growth-triad-v6-types';

describe('Smart-Link Yield Engine', () => {
  const offerA: AffiliateOffer = {
    id: 'off-clickbank-1',
    name: 'AI Video Masterclass',
    network: 'CLICKBANK',
    targetUrl: 'https://hop.clickbank.net/?aff=sophia',
    epcUsd: 4.5,
    gravity: 100, // sqrt(100) = 10
    refundRatePct: 5, // (1 - 0.05) = 0.95
    commissionPct: 50, // 0.50
    niche: 'saas_video',
  };

  const offerB: AffiliateOffer = {
    id: 'off-amazon-2',
    name: 'Vlogger Microphone Gear',
    network: 'AMAZON',
    targetUrl: 'https://amzn.to/3xyz',
    epcUsd: 1.2,
    gravity: 25, // sqrt(25) = 5
    refundRatePct: 2, // 0.98
    commissionPct: 10, // 0.10
    niche: 'hardware',
  };

  it('calculates expected yield EV using gravity, refund, and commission factors', () => {
    // 4.5 * 10 * 0.95 * 0.50 * 1.0 = 21.375 -> 21.38
    const ev = calculateExpectedYield(offerA, 'saas_video');
    expect(ev).toBeCloseTo(21.38, 1);
  });

  it('penalizes mismatched niche when calculating EV', () => {
    const matchedEv = calculateExpectedYield(offerA, 'saas_video');
    const mismatchedEv = calculateExpectedYield(offerA, 'crypto');
    expect(mismatchedEv).toBeLessThan(matchedEv);
  });

  it('selects best yield offer and constructs geo routing URL', () => {
    const result = matchBestYieldOffer([offerA, offerB], 'saas_video', 'VN');
    expect(result).not.toBeNull();
    expect(result?.offerId).toBe('off-clickbank-1');
    expect(result?.expectedYieldUsd).toBeGreaterThan(15);
    expect(result?.geoRoutingUrl).toContain('geo=VN');
    expect(result?.fallbackNetwork).toBe('AMAZON');
  });

  it('returns null when offer list is empty', () => {
    expect(matchBestYieldOffer([], 'saas_video')).toBeNull();
  });
});
