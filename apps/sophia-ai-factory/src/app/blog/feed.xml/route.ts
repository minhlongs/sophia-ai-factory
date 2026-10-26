/**
 * RSS 2.0 feed for Sophia AI Factory blog.
 * Route: /blog/feed.xml
 * Locale-agnostic — imports canonical POSTS from blog-posts-data.ts so RSS and HTML never drift.
 */

import { NextResponse } from 'next/server';
import { POSTS } from '@/app/[locale]/blog/blog-posts-data';

const SITE_URL = 'https://sophia.agencyos.network';
const FEED_TITLE = 'Sophia AI Factory Blog';
const FEED_DESCRIPTION =
  'News, guides and tips for AI video creation, affiliate revenue, and USDT payments | Tin tức, hướng dẫn và mẹo tạo video AI, thu nhập affiliate, thanh toán USDT';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET(): NextResponse {
  const buildDate = new Date().toUTCString();

  const items = POSTS.map((post) => {
    const pubDate = new Date(post.date).toUTCString();
    const normalizedHref = post.href.startsWith('/en/') ? post.href : `/en${post.href}`;
    const link = `${SITE_URL}${normalizedHref}#${post.slug}`;
    return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`.trim();
  }).join('\n    ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${SITE_URL}/en/blog</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en-vi</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
