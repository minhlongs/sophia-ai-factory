/**
 * @file trend-signal-matcher.test.ts
 * @description Unit tests for Trend Signal Matcher and Fast-Track Script Planning
 */

import { describe, it, expect } from 'vitest';
import { matchTrendToAffiliateProduct, type CatalogProduct } from '@/tree/newsjacking/trend-signal-matcher';
import { buildFastTrackNewsjackPlan } from '@/tree/newsjacking/fast-track-script-generator';

describe('TrendSignalMatcher', () => {
  const catalog: CatalogProduct[] = [
    {
      id: 'prod_vpn',
      title: 'NordVPN 2-Year Security',
      niche: 'Cybersecurity',
      keywords: ['security', 'exploit', 'hacker', 'privacy', 'ios'],
      commissionRate: 0.6,
    },
    {
      id: 'prod_coffee',
      title: 'Espresso Maker Portable',
      niche: 'Kitchen',
      keywords: ['coffee', 'travel', 'brew'],
      commissionRate: 0.15,
    },
  ];

  it('accurately matches cybersecurity trend to VPN product', () => {
    const result = matchTrendToAffiliateProduct('Apple iOS exploit security breach', catalog);
    expect(result.bestProductId).toBe('prod_vpn');
    expect(result.similarityScore).toBeGreaterThan(0.3);
    expect(result.matchAngle).toContain('Apple iOS exploit security breach');
  });

  it('builds high-converting 30-second script plan with 3 visual prompts', () => {
    const plan = buildFastTrackNewsjackPlan('Global Cyber Attack', 'NordVPN', 'Tech');
    expect(plan.targetDurationSec).toBe(30);
    expect(plan.hook3s).toContain('Global Cyber Attack');
    expect(plan.visualSlidePrompts).toHaveLength(3);
    expect(plan.visualSlidePrompts[0]).toContain('9:16 vertical');
  });
});
