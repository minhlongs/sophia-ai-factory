/**
 * @file sponsorship-valuation-engine.test.ts
 * @description Unit tests for Sponsorship Valuation Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSponsorshipValuation,
  generateBrandPitchEmail,
} from '../sponsorship-valuation-engine';

describe('Sponsorship Valuation Engine', () => {
  it('computes accurate sponsorship rate cards for high CPM finance channel', () => {
    const rateCard = calculateSponsorshipValuation({
      channelId: 'chan-fin-01',
      channelName: 'Alpha Wealth',
      niche: 'FINANCE',
      expected30dViews: 100000,
      engagementRate: 0.05, // 5% -> 50% boost
      tier1AudiencePct: 80, // geo factor: 0.5 + 0.4 = 0.9
      baseCpmUsd: 25.0,
    });

    // Base: 25 * 100 = 2500
    // Niche multiplier: 2.2 -> 5500
    // Engagement boost: 1 + 0.5 = 1.5 -> 8250
    // Geo factor: 0.5 + 0.5*0.8 = 0.9 -> 7425
    expect(rateCard.dedicatedVideoUsd).toBe(7425);
    expect(rateCard.sixtySecMidRollUsd).toBe(3712.5);
    expect(rateCard.thirtySecPreRollUsd).toBe(2227.5);
    expect(rateCard.shoutoutOrCommunityUsd).toBe(1113.75);
    expect(rateCard.effectiveCpmUsd).toBe(74.25);
  });

  it('clamps tier 1 audience percentage within 0-100 bounds', () => {
    const rateCardMin = calculateSponsorshipValuation({
      channelId: 'chan-02',
      channelName: 'Global Vlogs',
      niche: 'LIFESTYLE',
      expected30dViews: 50000,
      engagementRate: 0.02,
      tier1AudiencePct: 0,
      baseCpmUsd: 20.0,
    });

    expect(rateCardMin.dedicatedVideoUsd).toBeGreaterThan(0);
    expect(rateCardMin.effectiveCpmUsd).toBeGreaterThan(0);
  });

  it('generates well-formatted B2B pitch email', () => {
    const rateCard = calculateSponsorshipValuation({
      channelId: 'chan-saas-01',
      channelName: 'DevTools Digest',
      niche: 'SAAS',
      expected30dViews: 40000,
      engagementRate: 0.04,
      tier1AudiencePct: 90,
      baseCpmUsd: 30.0,
    });

    const email = generateBrandPitchEmail(
      'DevTools Digest',
      'SAAS',
      40000,
      rateCard,
      'Stripe'
    );

    expect(email.subject).toContain('DevTools Digest x Stripe');
    expect(email.body).toContain('Dedicated Video Integration');
    expect(email.body).toContain(rateCard.dedicatedVideoUsd.toLocaleString());
  });
});
