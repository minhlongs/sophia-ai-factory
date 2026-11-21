/**
 * Blog index page — static list of featured posts.
 * Posts link to existing guide pages; full CMS integration is out of scope.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buildPublicPageMetadata } from '@/seed/aeo';
import { WebPageJsonLd } from '@/forest/components/aeo';
import { POSTS } from './blog-posts-data';

// Blog list is fully static — cache aggressively at the edge.
// `force-static` opts out of dynamic rendering inherited from the [locale] segment.
export const revalidate = 3600;
export const dynamic = 'force-static';

function getBlogMeta(locale: string) {
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Blog — Sophia AI Factory' : 'Blog — Sophia AI Factory',
    description: isVi
      ? 'Tin tức, hướng dẫn và mẹo tạo video AI tự động hiệu quả cùng Sophia AI Factory.'
      : 'News, guides, and practical tips for automated AI video production with Sophia AI Factory.',
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = getBlogMeta(locale);
  const base = buildPublicPageMetadata({ locale, path: '/blog', title, description });
  return {
    ...base,
    alternates: {
      ...base.alternates,
      types: {
        'application/rss+xml': 'https://sophia.agencyos.network/blog/feed.xml',
      },
    },
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { title, description } = getBlogMeta(locale);
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <WebPageJsonLd
        id="blog"
        title={title}
        description={description}
        path="/blog"
        locale={locale}
        schemaType="CollectionPage"
        staticRender
      />
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