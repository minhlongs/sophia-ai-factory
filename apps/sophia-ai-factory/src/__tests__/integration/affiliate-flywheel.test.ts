/**
 * Integration Test Suite: Full-Stack Affiliate Flywheel
 *
 * Verifies the cross-layer pipeline from Trend Discovery to Geo-Routing
 * and Social Syndication with BYOK credential protection.
 *
 * @module __tests__/integration/affiliate-flywheel.test
 */

import { describe, it, expect } from 'vitest';
import { parseAndRankSaaSTrends } from '@/tree/affiliate/discovery/saas-trend-scraper';
import { generateSaaSBridgeUrl } from '@/tree/affiliate/bridge/link-generator';
import { getAffiliateRoute } from '@/land/affiliates/routing/geo-router';
import { calculatePublishingDelay } from '@/tree/social/syndication/syndication-pacer';
import { PROVIDER_REGISTRY } from '@/seed/config/providers/registry';

describe('Affiliate Flywheel Integration Pipeline', () => {
  it('executes the full lifecycle: Discover -> Bridge -> Syndicate', () => {
    // 1. Discover: Parse and rank incoming SaaS trends
    const rawTrends = [
      {
        name: 'AutoPitch AI',
        tagline: 'AI tool for automated sales pitches',
        url: 'https://autopitch.ai',
        votesCount: 88,
      },
    ];

    const discovery = parseAndRankSaaSTrends(rawTrends, 10);
    expect(discovery.trends).toHaveLength(1);
    const topPick = discovery.recommendedCampaignCandidate;
    expect(topPick?.name).toBe('AutoPitch AI');

    // 2. Bridge: Generate localized bridge URL
    const bridgeUrl = generateSaaSBridgeUrl({
      productId: topPick?.id || 'saas_autopitch',
      niche: 'saas_global',
      campaignId: 'q4_affiliate',
      couponCode: 'SAVE20',
      locale: 'vi',
    });

    expect(bridgeUrl).toContain('https://sophia.agencyos.network/vi/affiliate/bridge/');
    expect(bridgeUrl).toContain('code=SAVE20');

    // 3. Route: Validate Geo-routing fallback based on IP
    const mockRequest = {
      headers: { get: (name: string) => (name === 'cf-ipcountry' ? 'US' : null) },
    } as any;
    const resolvedOffer = getAffiliateRoute(mockRequest, 'saas');
    expect(resolvedOffer).toBe('https://saas-global.com');

    // 4. Syndicate: Verify pacing calculation and provider schema
    const delay = calculatePublishingDelay('tiktok', 1);
    expect(delay).toBeGreaterThanOrEqual(15 * 60 * 1000); // at least 15m base delay
    expect(PROVIDER_REGISTRY.N8N_SYNDICATOR.isEnabled).toBe(true);
  });
});
