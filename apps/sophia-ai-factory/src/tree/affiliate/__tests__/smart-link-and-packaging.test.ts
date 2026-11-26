/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { resolveSmartLinkDestination } from '@/tree/affiliate/smart-link-router';
import { buildBuyerIntentPackagingKit } from '@/tree/seo/buyer-intent-packaging';

describe('Global Stack Core — Smart-Link Geo/AB Router & Buyer-Intent SEO Packaging', () => {
  it('routes by CF-IPCountry, splits A/B weights deterministically, and falls back when unhealthy', () => {
    const destinations = [
      { id: 'us_coinbase', url: 'https://coinbase.com/?ref=us', weight: 100, countries: ['US'] },
      { id: 'global_a', url: 'https://bybit.com/?ref=a', weight: 50 },
      { id: 'global_b', url: 'https://okx.com/?ref=b', weight: 50 },
      { id: 'dead_offer', url: 'https://dead.example.com', weight: 100, countries: ['DE'], healthy: false },
    ];

    const usRoute = resolveSmartLinkDestination({
      destinations,
      fallbackUrl: 'https://fallback.example.com',
      countryCode: 'us',
      visitorSeed: 'ip_hash_1',
    });
    expect(usRoute.matchedBy).toBe('geo_weighted');
    expect(usRoute.selectedId).toBe('us_coinbase');

    const vnRoute = resolveSmartLinkDestination({
      destinations,
      fallbackUrl: 'https://fallback.example.com',
      countryCode: 'VN',
      visitorSeed: 'ip_hash_2',
    });
    expect(vnRoute.matchedBy).toBe('global_weighted');
    expect(['global_a', 'global_b']).toContain(vnRoute.selectedId);

    const fallbackRoute = resolveSmartLinkDestination({
      destinations: [{ id: 'dead', url: 'https://dead.example.com', weight: 10, healthy: false }],
      fallbackUrl: 'https://fallback.example.com',
      countryCode: 'DE',
      visitorSeed: 'ip_hash_3',
    });
    expect(fallbackRoute.matchedBy).toBe('fallback');
    expect(fallbackRoute.url).toBe('https://fallback.example.com');
  });

  it('builds bilingual VI/EN buyer-intent keywords and 3x Title/Thumbnail packaging variants', () => {
    const viKit = buildBuyerIntentPackagingKit({
      productName: 'Bybit',
      vertical: 'crypto',
      competitorName: 'OKX',
      locale: 'vi',
      year: 2026,
    });
    expect(viKit.buyerIntentKeywords).toHaveLength(4);
    expect(viKit.variants).toHaveLength(3);
    expect(viKit.variants[1].title).toContain('Bybit vs OKX');

    const enKit = buildBuyerIntentPackagingKit({
      productName: 'Notion AI',
      vertical: 'saas',
      locale: 'en',
      year: 2026,
    });
    expect(enKit.buyerIntentKeywords[0]).toContain('Notion AI review 2026');
    expect(enKit.variants).toHaveLength(3);
  });
});
