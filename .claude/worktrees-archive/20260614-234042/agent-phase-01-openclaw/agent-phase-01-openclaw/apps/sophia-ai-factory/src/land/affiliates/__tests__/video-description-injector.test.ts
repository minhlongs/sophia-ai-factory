/**
 * Unit tests for the affiliate-link description injector algorithm.
 * Covers: pure URL builder, footer formatter, empty-state behavior,
 * D1-fetch with niche boost, and graceful degradation when D1 fails.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateServerClient } = vi.hoisted(() => {
  const limit = vi.fn();
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order, limit }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const createServerClient = vi.fn(() => ({ from }));
  return { mockCreateServerClient: createServerClient };
});

vi.mock('@/seed/db/client', () => ({
  createServerClient: mockCreateServerClient,
}));

import {
  buildVideoDescription,
  buildTrackedUrl,
  formatAffiliateFooter,
} from '@/land/affiliates/video-description-injector';

describe('buildTrackedUrl', () => {
  it('appends ref + sub_id to bare URL', () => {
    const out = buildTrackedUrl('https://shop.example.com/widget', 'CODE42', 'abc');
    const url = new URL(out);
    expect(url.searchParams.get('ref')).toBe('CODE42');
    expect(url.searchParams.get('sub_id')).toBe('abc');
  });

  it('preserves existing query params + overwrites ref', () => {
    const out = buildTrackedUrl('https://shop.example.com/widget?utm_source=blog&ref=OLD', 'NEW', null);
    const url = new URL(out);
    expect(url.searchParams.get('utm_source')).toBe('blog');
    expect(url.searchParams.get('ref')).toBe('NEW');
    expect(url.searchParams.get('sub_id')).toBeNull();
  });

  it('returns malformed URL unchanged', () => {
    expect(buildTrackedUrl('not-a-url', 'CODE', 'sub')).toBe('not-a-url');
  });

  it('skips sub_id when whitespace-only', () => {
    const out = buildTrackedUrl('https://shop.example.com', 'CODE', '   ');
    expect(new URL(out).searchParams.get('sub_id')).toBeNull();
  });
});

describe('formatAffiliateFooter', () => {
  it('returns empty string for empty list', () => {
    expect(formatAffiliateFooter([])).toBe('');
  });

  it('renders one line per link with tracked URL', () => {
    const out = formatAffiliateFooter([
      { code: 'C1', subId: null, offerTitle: 'Widget Pro', productUrl: 'https://shop.example.com/w', niche: 'tech' },
    ]);
    expect(out).toContain('Widget Pro');
    expect(out).toContain('ref=C1');
    expect(out).toContain('🔗 Resources mentioned:');
  });
});

describe('buildVideoDescription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function stubLinks(rows: Array<{ code: string; sub_id: string | null; affiliate_offers: { title: string | null; product_url: string; niche: string | null } }>): void {
    // Re-wire the chained DB mock so .limit() returns the supplied rows.
    const limit = vi.fn().mockResolvedValue({ data: rows });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order, limit }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    mockCreateServerClient.mockReturnValue({ from } as unknown as ReturnType<typeof mockCreateServerClient>);
  }

  it('returns baseBody unchanged when user has no affiliate links', async () => {
    stubLinks([]);
    const result = await buildVideoDescription({ userId: 'u1', baseBody: 'hello world' });
    expect(result.description).toBe('hello world');
    expect(result.affiliateCount).toBe(0);
    expect(result.appliedNicheBoost).toBe(false);
  });

  it('appends footer with up to maxLinks affiliate URLs', async () => {
    stubLinks([
      { code: 'A', sub_id: null, affiliate_offers: { title: 'Alpha', product_url: 'https://a.example.com', niche: 'tech' } },
      { code: 'B', sub_id: '7', affiliate_offers: { title: 'Beta', product_url: 'https://b.example.com', niche: 'tech' } },
      { code: 'C', sub_id: null, affiliate_offers: { title: 'Gamma', product_url: 'https://c.example.com', niche: 'tech' } },
      { code: 'D', sub_id: null, affiliate_offers: { title: 'Delta', product_url: 'https://d.example.com', niche: 'tech' } },
    ]);
    const result = await buildVideoDescription({ userId: 'u1', baseBody: 'Watch this!', maxLinks: 3 });
    expect(result.affiliateCount).toBe(3);
    expect(result.description.startsWith('Watch this!')).toBe(true);
    expect(result.description).toContain('Alpha');
    expect(result.description).toContain('Beta');
    expect(result.description).toContain('Gamma');
    expect(result.description).not.toContain('Delta');
    expect(result.description).toContain('ref=A');
    expect(result.description).toContain('sub_id=7');
  });

  it('boosts niche-matched offers to the top of the picks', async () => {
    stubLinks([
      { code: 'OFF', sub_id: null, affiliate_offers: { title: 'Off-niche', product_url: 'https://x.example.com', niche: 'gaming' } },
      { code: 'MATCH1', sub_id: null, affiliate_offers: { title: 'Camera Bag', product_url: 'https://m1.example.com', niche: 'photography' } },
      { code: 'MATCH2', sub_id: null, affiliate_offers: { title: 'Lens Kit', product_url: 'https://m2.example.com', niche: 'photography gear' } },
    ]);
    const result = await buildVideoDescription({
      userId: 'u1',
      baseBody: 'Top photo tips',
      nicheHint: 'photography',
      maxLinks: 2,
    });
    expect(result.appliedNicheBoost).toBe(true);
    expect(result.links.map((l) => l.code)).toEqual(['MATCH1', 'MATCH2']);
    expect(result.description).not.toContain('Off-niche');
  });

  it('degrades gracefully when D1 throws', async () => {
    mockCreateServerClient.mockReturnValue({
      from: () => {
        throw new Error('D1 unavailable');
      },
    } as unknown as ReturnType<typeof mockCreateServerClient>);
    const result = await buildVideoDescription({ userId: 'u1', baseBody: 'Still valid' });
    expect(result.description).toBe('Still valid');
    expect(result.affiliateCount).toBe(0);
  });

  it('clamps maxLinks between 1 and 5', async () => {
    stubLinks(
      Array.from({ length: 10 }).map((_, i) => ({
        code: `C${i}`,
        sub_id: null,
        affiliate_offers: { title: `Offer ${i}`, product_url: `https://o${i}.example.com`, niche: null },
      })),
    );
    const tooMany = await buildVideoDescription({ userId: 'u1', baseBody: '', maxLinks: 99 });
    expect(tooMany.affiliateCount).toBe(5);
    const tooFew = await buildVideoDescription({ userId: 'u1', baseBody: '', maxLinks: 0 });
    expect(tooFew.affiliateCount).toBe(1);
  });
});
