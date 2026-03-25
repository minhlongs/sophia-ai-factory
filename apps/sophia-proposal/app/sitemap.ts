import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/blog/blog-queries";

const SITE_URL = "https://sophia.agencyos.network";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/signup`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/docs/api`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/pilot`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  ];

  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const posts = await listPublishedPosts();
    blogRoutes = posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.published_at ?? post.created_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // D1 not available — return static only
  }

  return [...staticRoutes, ...blogRoutes];
}
