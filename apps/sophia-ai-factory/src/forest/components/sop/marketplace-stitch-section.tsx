"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AMBER } from "./marketplace/types";
import { MarketplaceFilterControls } from "./marketplace/marketplace-filter-controls";
import { MarketplaceCard } from "./marketplace/marketplace-card";
import { useMarketplaceTemplates } from "./marketplace/use-marketplace-templates";

import type { MarketplaceStitchSectionProps } from "./marketplace/types";

export function MarketplaceStitchSection({
  initialTemplates,
  initialCategory,
  fetchUrl,
}: MarketplaceStitchSectionProps) {
  const t = useTranslations("sop.marketplace");

  const {
    loading,
    error,
    query,
    setQuery,
    category,
    setCategory,
    allCategories,
    sort,
    setSort,
    filtered,
  } = useMarketplaceTemplates({
    initialTemplates,
    initialCategory,
    fetchUrl,
  });

  return (
    <section
      className="min-h-screen bg-[#0F0F11] py-12 md:py-20"
      style={{ "--amber": AMBER } as React.CSSProperties}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm md:text-base lg:text-lg text-[#A1A1AA]">{t("subtitle")}</p>
        </div>

        <MarketplaceFilterControls
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          allCategories={allCategories}
          sort={sort}
          onSortChange={setSort}
          t={t}
        />

        <p className="mt-4 text-xs text-[#52525B]">
          {t("resultsCount", { count: filtered.length })}
        </p>

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
          <div className="mt-8 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {filtered.map((item) => (
              <MarketplaceCard key={item.id} item={item} t={t} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

MarketplaceStitchSection.displayName = "MarketplaceStitchSection";