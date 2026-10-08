/**
 * @file epc-velocity-engine.test.ts
 * @description Zero-mock unit tests for 7-day rolling EPC and dynamic tier escalation
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import { calculateEpcMetrics, generateAffiliateSubId } from '../epc-velocity-engine';

describe('Affiliate EPC Velocity Engine', () => {
  it('correctly calculates high EPC and diamond elite tier', () => {
    const result = calculateEpcMetrics({
      campaignId: 'camp-1',
      clicks7d: 1000,
      conversions7d: 80,
      grossRevenueUsd: 3200,
    });

    expect(result.epcUsd).toBe(3.2);
    expect(result.conversionRate).toBe(0.08);
    expect(result.commissionTier).toBe('DIAMOND_ELITE');
    expect(result.commissionSplitPercentage).toBe(40);
  });

  it('correctly calculates standard tier for low revenue campaigns', () => {
    const result = calculateEpcMetrics({
      campaignId: 'camp-2',
      clicks7d: 500,
      conversions7d: 5,
      grossRevenueUsd: 100,
    });

    expect(result.epcUsd).toBe(0.2);
    expect(result.commissionTier).toBe('STANDARD');
    expect(result.commissionSplitPercentage).toBe(10);
  });

  it('handles zero clicks gracefully without division by zero', () => {
    const result = calculateEpcMetrics({
      campaignId: 'camp-zero',
      clicks7d: 0,
      conversions7d: 0,
      grossRevenueUsd: 0,
    });

    expect(result.epcUsd).toBe(0);
    expect(result.commissionTier).toBe('STANDARD');
  });

  it('generates deterministic sub-ID tokens', () => {
    const subId = generateAffiliateSubId('aff-123', 'usr-87654321', 'TikTok-Shop!');
    expect(subId).toBe('sub_aff-123_usr-8765_tiktokshop');
  });
});
