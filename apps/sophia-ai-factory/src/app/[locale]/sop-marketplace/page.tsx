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

/** generateMetadata that reads ?category= for dynamic SEO title. */
export async function generateMetadata({
  searchParams,
}: SopMarketplacePageProps): Promise<Metadata> {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : null;
  const t = await getTranslations("sop.marketplace");

  const title = category
    ? `SOP Marketplace: ${category} Templates | Sophia AI Factory`
    : `${t("title")} | Sophia AI Factory`;

  return {
    title,
    openGraph: { title },
    twitter: { title },
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
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/sop-marketplace?limit=100`, {
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
    // Build-time fetch may fail — MarketplaceStitchSection shows empty state
    templates = [];
  }

  const collectionName = initialCategory
    ? `SOP Marketplace: ${initialCategory} Templates`
    : t("title");

  return (
    <>
      {/* Structured data — CollectionPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: collectionName,
            description: t("subtitle"),
            numberOfItems: templates.length,
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
