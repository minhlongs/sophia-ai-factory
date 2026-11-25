/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildDefaultStorefrontHub,
  buildStorefrontHubJsonLd,
  buildStorefrontHubMarkdown,
  escapeHubJsonLd,
} from '../storefront-hub-builder';
import { GET as getHubMd } from '@/app/hub/[handle]/md/route';

describe('Public Crypto + SaaS Affiliate Storefront Hub (/hub/[handle])', () => {
  it('builds escaped CollectionPage JSON-LD and Markdown with Telegram Concierge & GEO links', () => {
    const escaped = escapeHubJsonLd('{"x":"</script>&<a>"}');
    expect(escaped).not.toContain('</script>');
    expect(JSON.parse(escaped)).toEqual({ x: '</script>&<a>' });

    const base = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';
    const profile = buildDefaultStorefrontHub('alex-saas', base);
    const jsonLd = buildStorefrontHubJsonLd(profile, base);
    const parsed = JSON.parse(jsonLd) as { '@type': string; url: string };
    expect(parsed['@type']).toBe('CollectionPage');
    expect(parsed.url).toBe(`${base}/hub/alex-saas`);

    const md = buildStorefrontHubMarkdown(profile, base);
    expect(md).toContain('@alex-saas');
    expect(md).toContain('https://t.me/Sophia_Bbot?start=concierge_alex-saas');
    expect(md).toContain('/c/alex-saas-saas-stack');
  });

  it('serves /hub/[handle]/md and rejects invalid handles with 400', async () => {
    const okRes = await getHubMd(new NextRequest('http://localhost/hub/alex-saas/md'), {
      params: Promise.resolve({ handle: 'alex-saas' }),
    });
    expect(okRes.status).toBe(200);
    expect(await okRes.text()).toContain('@alex-saas');

    const badRes = await getHubMd(new NextRequest('http://localhost/hub/bad%20handle!/md'), {
      params: Promise.resolve({ handle: 'bad handle!' }),
    });
    expect(badRes.status).toBe(400);
  });
});
