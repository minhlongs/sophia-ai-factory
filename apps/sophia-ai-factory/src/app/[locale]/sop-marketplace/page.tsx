/**
 * /[locale]/sop-marketplace — Public SOP marketplace page (locale-routed).
 *
 * Server component: fetches published SOP templates from the public API
 * and passes them to the MarketplaceStitchSection for rendering.
 *
 * Supports searchParams ?category= for per-category SEO metadata.
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketplaceStitchSection } from "@/forest/components/sop/marketplace-stitch-section";

export const dynamic = "force-dynamic";

interface SopTemplateData {
  id: string;
  templateId: string;
  name: string;
  category: string;
  priceCents: number;
  tags: string[];
  totalSales: number;
  totalRevenueCents: number;
  ratingAvg: number;
  ratingCount: number;
  publishedAt: string;
  previewMd: string | null;
  demoVideoUrl: string | null;
  authorUserId: string | null;
}

interface SopMarketplacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://sophia.agencyos.network";

function canonicalUrl(category?: string): string {
  return category
    ? `${APP_URL}/sop-marketplace?category=${encodeURIComponent(category)}`
    : `${APP_URL}/sop-marketplace`;
}

function seoDescription(
  t: Awaited<ReturnType<typeof getTranslations>>,
  listingCount: number,
  category?: string,
): string {
  if (category) {
    return `${category} SOP automation templates on Sophia AI Factory — ${listingCount} templates available.`;
  }
  return t("seoDescription");
}

export async function generateMetadata({
  searchParams,
}: SopMarketplacePageProps): Promise<Metadata> {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : null;
  const t = await getTranslations("sop.marketplace");
  const titleBase = t("title");
  const title =
    category !== null
      ? `${category} SOP Templates | ${titleBase}`
      : `${titleBase}`;
  return {
    title,
    description: seoDescription(t, 0, category ?? undefined),
    alternates: {
      canonical: canonicalUrl(category ?? undefined),
    },
    openGraph: {
      title,
      description: seoDescription(t, 0, category ?? undefined),
      url: canonicalUrl(category ?? undefined),
      siteName: "Sophia AI Factory",
      type: "website",
    },
    twitter: {
      title,
      description: seoDescription(t, 0, category ?? undefined),
      card: "summary_large_image",
    },
  };
}

export default async function SopMarketplacePage({
  searchParams,
}: SopMarketplacePageProps) {
  const sp = await searchParams;
  const initialCategory =
    typeof sp.category === "string" ? sp.category : undefined;

  const t = await getTranslations("sop.marketplace");

  let templates: SopTemplateData[] = [];
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const params =
      initialCategory !== undefined
        ? `?category=${encodeURIComponent(initialCategory)}&limit=100`
        : "?limit=100";
    const res = await fetch(`${base}/api/sop-marketplace${params}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as {
        templates?: SopTemplateData[];
      };
      templates = json.templates ?? [];
    }
  } catch {
    // Build-time / D1 fetch may fail — MarketplaceStitchSection shows empty state.
    templates = [];
  }

  const collectionName =
    initialCategory !== undefined
      ? `SOP Marketplace: ${initialCategory} Templates`
      : t("title");

  // Compute description with real count for server-rendered structured data.
  const seoDesc = seoDescription(t, templates.length, initialCategory);

  return (
    <>
      {/* Structured data — ItemList (ported from old client JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: collectionName,
            description: seoDesc,
            numberOfItems: templates.length,
            itemListElement: templates.slice(0, 20).map((item, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              item: {
                "@type": "Product",
                name: item.name,
                category: item.category,
                offers: {
                  "@type": "Offer",
                  priceCurrency: "USD",
                  price: (item.priceCents / 100).toFixed(2),
                },
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: item.ratingAvg.toFixed(1),
                  reviewCount: item.ratingCount,
                  bestRating: 5,
                  worstRating: 1,
                },
              },
            })),
          }),
        }}
      />

      <MarketplaceStitchSection
        initialTemplates={templates}
        initialCategory={initialCategory}
      />
    </>
  );
}
