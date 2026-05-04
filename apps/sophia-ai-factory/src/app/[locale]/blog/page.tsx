/**
 * Blog index page — static list of featured posts.
 * Posts link to existing guide pages; full CMS integration is out of scope.
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog — Sophia AI Factory',
  description:
    'Tin tức, hướng dẫn và mẹo sử dụng Sophia AI Video Factory',
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
            className="group block bg-card/50 border border-border/40 rounded-xl p-6 hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <time dateTime={post.date}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(post.date))}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readTime}</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground group-hover:text-violet-300 transition-colors flex items-center gap-2">
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
