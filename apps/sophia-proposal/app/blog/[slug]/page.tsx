import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/blog/blog-queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post Not Found — Sophia AI Factory" };
  return {
    title: `${post.title} — Sophia AI Factory`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.published_at ?? undefined,
    },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Organization", name: post.author },
    datePublished: post.published_at,
    dateModified: post.updated_at,
  };

  const paragraphs = post.content.split("\n\n").filter(Boolean);

  return (
    <main className="min-h-screen bg-surface">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Nav */}
      <nav className="bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
            </div>
            <span className="font-bold text-on-surface">Sophia AI Factory</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/blog" className="text-sm text-on-surface-variant hover:text-on-surface">Blog</a>
            <a href="/pilot" className="text-sm px-4 py-1.5 bg-primary text-white rounded-full hover:opacity-90 font-medium">
              Early Access
            </a>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <a
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-8 group"
          >
            <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            All Posts
          </a>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-4 leading-tight tracking-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-3 text-sm text-on-surface-variant mb-10 pb-8 border-b border-outline-variant">
            <span className="font-medium text-on-surface">{post.author}</span>
            {post.published_at && (
              <>
                <span>·</span>
                <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
              </>
            )}
          </div>

          {/* Content */}
          <div className="prose prose-lg prose-gray max-w-none">
            {paragraphs.map((para, i) => (
              <p key={i} className="mb-5 text-on-surface leading-relaxed text-base">
                {para}
              </p>
            ))}
          </div>

          {/* Footer CTA */}
          <div className="mt-14 pt-8 border-t border-outline-variant text-center">
            <p className="text-on-surface font-semibold mb-4">
              Ready to automate your proposals?
            </p>
            <a
              href="/pilot"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-semibold hover:opacity-90 transition-opacity text-sm glow-primary"
            >
              <span className="material-symbols-outlined text-base">rocket_launch</span>
              Apply for Early Access
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}
