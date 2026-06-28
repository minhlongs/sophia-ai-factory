/**
 * RSS 2.0 feed for Sophia AI Factory blog.
 * Route: /blog/feed.xml
 * Locale-agnostic — all posts listed in English + Vietnamese bilingual titles.
 */

import { NextResponse } from 'next/server';

const SITE_URL = 'https://sophia.agencyos.network';
const FEED_TITLE = 'Sophia AI Factory Blog';
const FEED_DESCRIPTION =
  'News, guides and tips for AI video creation, affiliate revenue, and USDT payments | Tin tức, hướng dẫn và mẹo tạo video AI, thu nhập affiliate, thanh toán USDT';

interface RssPost {
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  date: string;
}

// Keep in sync with /src/app/[locale]/blog/page.tsx POSTS array
const POSTS: RssPost[] = [
  {
    slug: 'getting-started',
    href: '/en/guide/how-it-works',
    title: 'Hướng Dẫn Bắt Đầu Với Sophia AI Factory',
    excerpt: 'Tạo video AI đầu tiên của bạn trong 5 phút — không cần kỹ thuật.',
    date: '2026-04-15',
  },
  {
    slug: 'telegram-bot-tips',
    href: '/en/guide/telegram',
    title: '5 Mẹo Sử Dụng Telegram Bot Hiệu Quả',
    excerpt: 'Tạo video từ điện thoại, theo dõi tiến độ, và nhận thông báo tự động.',
    date: '2026-04-14',
  },
  {
    slug: 'affiliate-video-strategy',
    href: '/en/guide/how-it-works',
    title: 'Chiến Lược Video Affiliate: Từ 0 → $1000/Tháng',
    excerpt: 'Cách chọn sản phẩm, viết kịch bản AI, và tối ưu kênh YouTube faceless.',
    date: '2026-04-12',
  },
  {
    slug: 'non-tech-ceos-ai-video',
    href: '/en/guide/how-it-works',
    title: 'How Non-Tech CEOs Use AI to Create Video Content',
    excerpt:
      'No cameras, no editors, no video experience needed. See how business owners are publishing daily AI videos with zero technical skills.',
    date: '2026-05-01',
  },
  {
    slug: 'affiliate-passive-income',
    href: '/en/affiliate',
    title: '5 Ways to Earn Passive Income with Sophia Affiliate Program',
    excerpt:
      'Earn 70% commission on every referral. Share your link on YouTube, Telegram, blog posts, or social media — get paid in USDT every month.',
    date: '2026-05-05',
  },
  {
    slug: 'usdt-payments-guide',
    href: '/en/guide/faq',
    title: 'USDT Payments Explained: A Simple Guide for Business Owners',
    excerpt:
      'What is USDT, how to buy it, which network to use, and how to pay for Sophia subscription in under 5 minutes.',
    date: '2026-05-10',
  },
  {
    slug: 'first-week-with-sophia',
    href: '/en/guide/how-it-works',
    title: 'From Zero to Revenue: Your First Week with Sophia',
    excerpt:
      'Day-by-day onboarding guide: set up API keys, create your first campaign, publish to YouTube, and earn your first affiliate commission.',
    date: '2026-05-15',
  },
];

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
    const link = `${SITE_URL}${post.href}`;
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
