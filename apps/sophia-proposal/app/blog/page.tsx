import type { Metadata } from "next";
import { listPublishedPosts } from "@/lib/blog/blog-queries";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — Sophia AI Factory",
  description: "Insights on AI automation, agency growth, and the future of proposal generation.",
  openGraph: {
    title: "Sophia AI Factory Blog",
    description: "Insights on AI automation, agency growth, and proposal automation.",
    type: "website",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncate(text: string | null, maxLen = 140): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "…" : text;
}

export default async function BlogPage() {
  const posts = await listPublishedPosts();

  return (
    <main className="min-h-screen bg-surface">
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
            <a href="/" className="text-sm text-on-surface-variant hover:text-on-surface">Home</a>
            <a href="/pricing" className="text-sm text-on-surface-variant hover:text-on-surface">Pricing</a>
            <a href="/pilot" className="text-sm text-on-surface-variant hover:text-on-surface">Early Access</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-16 px-4 text-center bg-gradient-to-br from-surface to-surface-container">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface mb-4 tracking-tight">
            Blog
          </h1>
          <p className="text-lg text-on-surface-variant">
            AI automation, agency growth, and the future of proposals.
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4 block">
                article
              </span>
              <p className="text-on-surface-variant text-lg">No posts yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <ScrollReveal key={post.id} delay={i * 80}>
                  <article className="bg-surface-container rounded-2xl border border-outline-variant overflow-hidden flex flex-col h-full hover:border-primary/40 transition-colors">
                    <div className="p-6 flex flex-col flex-1">
                      {/* Tags */}
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {post.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <h2 className="text-lg font-bold text-on-surface mb-2 leading-snug">
                        {post.title}
                      </h2>

                      <p className="text-sm text-on-surface-variant leading-relaxed flex-1 mb-4">
                        {truncate(post.excerpt)}
                      </p>

                      <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
                        <div className="text-xs text-on-surface-variant">
                          <span className="font-medium text-on-surface">{post.author}</span>
                          {post.published_at && (
                            <span className="ml-2">{formatDate(post.published_at)}</span>
                          )}
                        </div>
                        <a
                          href={`/blog/${post.slug}`}
                          className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          Read more
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </a>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 bg-surface-container border-t border-outline-variant text-center">
        <p className="text-on-surface font-semibold mb-2">Ready to automate your proposals?</p>
        <a
          href="/pilot"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-semibold hover:opacity-90 transition-opacity text-sm"
        >
          <span className="material-symbols-outlined text-base">rocket_launch</span>
          Apply for Early Access
        </a>
      </section>
    </main>
  );
}
