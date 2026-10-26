import { describe, it, expect } from 'vitest';
import { POSTS } from '@/app/[locale]/blog/blog-posts-data';
import { GET } from '../route';

describe('RSS 2.0 Feed (/blog/feed.xml)', () => {
  it('renders valid RSS 2.0 XML containing all canonical POSTS without drift', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/xml');

    const xml = await response.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('hybrid-scene-graph-zero-hallucination-video');
    expect(xml).toContain('10-affiliate-networks-cex-saas-ltv-blueprint');

    for (const post of POSTS) {
      expect(xml).toContain(`#${post.slug}</link>`);
    }
  });
});
