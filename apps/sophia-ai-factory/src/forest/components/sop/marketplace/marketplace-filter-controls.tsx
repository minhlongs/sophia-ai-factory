"use client";

import React from "react";
import type { SortKey } from "./types";

interface MarketplaceFilterControlsProps {
  query: string;
  onQueryChange: (q: string) => void;
  category: string;
  onCategoryChange: (cat: string) => void;
  allCategories: string[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  t: (key: string) => string;
}

export function MarketplaceFilterControls({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  allCategories,
  sort,
  onSortChange,
  t,
}: MarketplaceFilterControlsProps) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
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
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-[#27272A] bg-[#18181B] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#52525B] transition-colors focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]/40"
          aria-label={t("searchPlaceholder")}
        />
      </div>

      {/* Category filter */}
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full sm:w-auto rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-2.5 text-sm text-[#A1A1AA] transition-colors focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]/40"
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
        onChange={(e) => onSortChange(e.target.value as SortKey)}
        className="w-full sm:w-auto rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-2.5 text-sm text-[#A1A1AA] transition-colors focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]/40"
        aria-label={t("sortBy")}
      >
        <option value="popular">{t("sortPopular")}</option>
        <option value="rating">{t("sortRating")}</option>
        <option value="newest">{t("sortNewest")}</option>
      </select>
    </div>
  );
}
