/**
 * Blog index page — static list of featured posts.
 * Posts link to existing guide pages; full CMS integration is out of scope.
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Blog list is fully static — cache aggressively at the edge.
// `force-static` opts out of dynamic rendering inherited from the [locale] segment.
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Blog — Sophia AI Factory',
  description:
    'News, guides and tips for Sophia AI Video Factory | Tin tức, hướng dẫn và mẹo sử dụng Sophia AI Video Factory',
  alternates: {
    types: {
      'application/rss+xml': 'https://sophia.agencyos.network/blog/feed.xml',
    },
  },
};

interface BlogPost {
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
}

const POSTS: BlogPost[] = [
  {
    slug: 'getting-started',
    href: '/guide/how-it-works',
    title: 'Hướng Dẫn Bắt Đầu Với Sophia AI Factory',
    excerpt:
      'Tạo video AI đầu tiên của bạn trong 5 phút — không cần kỹ thuật.',
    date: '2026-04-15',
    readTime: '3 phút',
  },
  {
    slug: 'telegram-bot-tips',
    href: '/guide/telegram',
    title: '5 Mẹo Sử Dụng Telegram Bot Hiệu Quả',
    excerpt:
      'Tạo video từ điện thoại, theo dõi tiến độ, và nhận thông báo tự động.',
    date: '2026-04-14',
    readTime: '4 phút',
  },
  {
    slug: 'affiliate-video-strategy',
    href: '/guide/how-it-works',
    title: 'Chiến Lược Video Affiliate: Từ 0 → $1000/Tháng',
    excerpt:
      'Cách chọn sản phẩm, viết kịch bản AI, và tối ưu kênh YouTube faceless.',
    date: '2026-04-12',
    readTime: '6 phút',
  },
  {
    slug: 'non-tech-ceos-ai-video',
    href: '/guide/how-it-works',
    title: 'How Non-Tech CEOs Use AI to Create Video Content — Cách CEO Không Kỹ Thuật Dùng AI Tạo Video',
    excerpt:
      'No cameras, no editors, no video experience needed. See how business owners are publishing daily AI videos with zero technical skills.',
    date: '2026-05-01',
    readTime: '5 min',
  },
  {
    slug: 'affiliate-passive-income',
    href: '/affiliate',
    title: '5 Ways to Earn Passive Income with Sophia Affiliate Program — 5 Cách Kiếm Thu Nhập Thụ Động',
    excerpt:
      'Earn 70% commission on every referral. Share your link on YouTube, Telegram, blog posts, or social media — get paid in USDT every month.',
    date: '2026-05-05',
    readTime: '4 min',
  },
  {
    slug: 'usdt-payments-guide',
    href: '/guide/faq',
    title: 'USDT Payments Explained: A Simple Guide for Business Owners — Hướng Dẫn USDT Đơn Giản',
    excerpt:
      'What is USDT, how to buy it, which network to use, and how to pay for Sophia subscription in under 5 minutes.',
    date: '2026-05-10',
    readTime: '5 min',
  },
  {
    slug: 'first-week-with-sophia',
    href: '/guide/how-it-works',
    title: 'From Zero to Revenue: Your First Week with Sophia — Tuần Đầu Tiên Với Sophia',
    excerpt:
      'Day-by-day onboarding guide: set up API keys, create your first campaign, publish to YouTube, and earn your first affiliate commission.',
    date: '2026-05-15',
    readTime: '6 min',
  },
];

export default function BlogPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
        Blog
      </h1>
      <p className="text-muted-foreground mb-10">
        Tin tức, hướng dẫn và mẹo tạo video AI hiệu quả.
      </p>

      <div className="space-y-6">
        {POSTS.map((post) => (
          <Link
            key={post.slug}
            href={post.href}
            className="group block bg-card/50 border border-border/40 rounded-xl p-6 hover:border-primary-500/40 hover:bg-primary-500/5 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <time dateTime={post.date}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(post.date))}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readTime}</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground group-hover:text-primary-300 transition-colors flex items-center gap-2">
              {post.title}
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
            </h2>
            <p className="text-sm text-muted-foreground mt-2">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
