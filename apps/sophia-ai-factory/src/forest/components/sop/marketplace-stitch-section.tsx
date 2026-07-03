"use client";

/**
 * MarketplaceStitchSection — Stitch-themed (dark bg, amber accent) card grid
 * for the public SOP marketplace.
 *
 * Amber accent: #D97706
 * Data shape matches GET /api/sop-marketplace response.
 */

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";

/* ── Types ────────────────────────────────────────────── */

interface MarketplaceTemplate {
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

type SortKey = "popular" | "rating" | "newest";

/* ── Star rating display (ported from old marketplace-client) ── */

function Stars({ avg }: { avg: number }) {
  const full = Math.floor(avg);
  const half = avg - full >= 0.5;
  return (
    <span
      className="text-amber-400"
      aria-label={`${avg.toFixed(1)} out of 5 stars`}
    >
      {"★".repeat(full)}
      {half ? "⯪" : ""}
      {"☆".repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

/* ── Category set (derived from data) ── */

function extractCategories(templates: MarketplaceTemplate[]): string[] {
  const seen = new Set<string>();
  for (const t of templates) {
    if (t.category) seen.add(t.category);
  }
  return Array.from(seen).sort();
}

/* ── Helpers ── */

function formatSales(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

const AMBER = "#D97706";

/* ── Component ────────────────────────────────────────── */

interface Props {
  initialTemplates?: MarketplaceTemplate[];
  initialCategory?: string;
  fetchUrl?: string;
}

export function MarketplaceStitchSection({
  initialTemplates,
  initialCategory,
  fetchUrl,
}: Props) {
  const t = useTranslations("sop.marketplace");

  const [templates, setTemplates] = useState<MarketplaceTemplate[]>(
    initialTemplates ?? [],
  );
  const [loading, setLoading] = useState(!initialTemplates);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "all");
  const [sort, setSort] = useState<SortKey>("popular");

  /* Fetch on mount if no initial data */
  useEffect(() => {
    if (initialTemplates) return;
    const url = fetchUrl ?? "/api/sop-marketplace?limit=100";

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ templates: MarketplaceTemplate[] }>;
      })
      .then((data) => {
        setTemplates(data.templates ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
  }, [initialTemplates, fetchUrl]);

  /* Resolve categories from loaded data */
  const allCategories = useMemo(
    () => ["all", ...extractCategories(templates)],
    [templates],
  );

  /* Filter + sort */
  const filtered = useMemo(() => {
    let list = templates;

    if (category !== "all") {
      list = list.filter((t) => t.category === category);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    if (sort === "popular") {
      list = [...list].sort((a, b) => b.totalSales - a.totalSales);
    } else if (sort === "rating") {
      list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg);
    }
    /* "newest" — server returns newest-first, keep as-is */

    return list;
  }, [templates, category, query, sort]);

  /* ── Render ── */

  return (
    <section
      className="min-h-screen bg-[#0F0F11] py-20"
      style={{ "--amber": AMBER } as React.CSSProperties}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-[#A1A1AA]">{t("subtitle")}</p>
        </div>

        {/* Controls row */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52525B]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-lg border border-[#27272A] bg-[#18181B] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#52525B] transition-colors focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]/40"
              aria-label={t("searchPlaceholder")}
            />
          </div>

          {/* Category filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-2.5 text-sm text-[#A1A1AA] transition-colors focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]/40"
            aria-label={t("filterCategory")}
          >
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "all" ? t("filterAll") : cat}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-2.5 text-sm text-[#A1A1AA] transition-colors focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]/40"
            aria-label={t("sortBy")}
          >
            <option value="popular">{t("sortPopular")}</option>
            <option value="rating">{t("sortRating")}</option>
            <option value="newest">{t("sortNewest")}</option>
          </select>
        </div>

        {/* Result count */}
        <p className="mt-4 text-xs text-[#52525B]">
          {t("resultsCount", { count: filtered.length })}
        </p>

        {/* Content area */}
        {loading ? (
          <div className="mt-12 flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#27272A] border-t-[#D97706]" />
          </div>
        ) : error ? (
          <div className="mt-12 rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 flex items-center justify-center rounded-lg border border-[#27272A] bg-[#18181B] py-20">
            <p className="text-sm text-[#71717A]">{t("noResults")}</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-lg border border-[#27272A] bg-[#18181B] transition-all duration-200 hover:border-[#D97706]/50 hover:shadow-[0_0_20px_rgba(217,119,6,0.08)]"
              >
                {/* JSON-LD Product schema */}
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                      "@context": "https://schema.org",
                      "@type": "Product",
                      name: item.name,
                      category: item.category,
                      offers: {
                        "@type": "Offer",
                        priceCurrency: "USD",
                        price: (item.priceCents / 100).toFixed(2),
                        url: `${typeof window !== "undefined" ? window.location.origin : ""}`,
                      },
                      aggregateRating: {
                        "@type": "AggregateRating",
                        ratingValue: item.ratingAvg.toFixed(1),
                        reviewCount: item.ratingCount,
                        bestRating: 5,
                      },
                    }),
                  }}
                />

                {/* Thumbnail placeholder */}
                <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#27272A] to-[#18181B]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="h-10 w-10 text-[#27272A] group-hover:text-[#D97706]/30 transition-colors duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  {/* Category badge */}
                  <span className="absolute bottom-2 left-2 rounded-md border border-[#27272A] bg-[#18181B]/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#D97706] backdrop-blur-sm">
                    {item.category}
                  </span>
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="text-sm font-semibold leading-snug text-white line-clamp-2">
                    {item.name}
                  </h3>

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#27272A]/60 px-2 py-0.5 text-[10px] text-[#71717A]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Author */}
                  {item.authorUserId && (
                    <p className="text-[10px] text-[#52525B]">
                      {t("byLabel")} #{item.authorUserId.slice(0, 6)}
                    </p>
                  )}

                  {/* Rating + Sales row */}
                  <div className="mt-auto flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-[#A1A1AA]">
                      <Stars avg={item.ratingAvg} />
                      <span className="text-[#71717A]">
                        {item.ratingAvg.toFixed(1)}
                      </span>
                    </span>
                    <span className="text-[#71717A]">
                      {formatSales(item.totalSales)} {t("sales")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
