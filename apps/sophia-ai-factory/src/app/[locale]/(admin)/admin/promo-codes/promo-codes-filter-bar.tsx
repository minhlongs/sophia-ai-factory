"use client";

/**
 * Filter bar for the promo codes list page.
 * Search input + status dropdown + tier dropdown + results count.
 */

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

export type PromoStatusFilter = "all" | "active" | "disabled" | "expired";
export type PromoTierFilter = "all" | "BASIC" | "PREMIUM" | "ENTERPRISE" | "MASTER";

interface PromoCodesFilterBarProps {
  search: string;
  status: PromoStatusFilter;
  tier: PromoTierFilter;
  resultsCount: number;
  onSearch: (v: string) => void;
  onStatus: (v: PromoStatusFilter) => void;
  onTier: (v: PromoTierFilter) => void;
}

export function PromoCodesFilterBar({
  search,
  status,
  tier,
  resultsCount,
  onSearch,
  onStatus,
  onTier,
}: PromoCodesFilterBarProps) {
  const t = useTranslations("admin.promoCodes.list");

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as PromoStatusFilter)}
        aria-label={t("filterStatusLabel")}
        className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <option value="all">{t("filterStatusAll")}</option>
        <option value="active">{t("filterStatusActive")}</option>
        <option value="disabled">{t("filterStatusDisabled")}</option>
        <option value="expired">{t("filterStatusExpired")}</option>
      </select>

      {/* Tier filter */}
      <select
        value={tier}
        onChange={(e) => onTier(e.target.value as PromoTierFilter)}
        aria-label={t("filterTierLabel")}
        className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <option value="all">{t("filterTierAll")}</option>
        <option value="BASIC">BASIC</option>
        <option value="PREMIUM">PREMIUM</option>
        <option value="ENTERPRISE">ENTERPRISE</option>
        <option value="MASTER">MASTER</option>
      </select>

      {/* Results count */}
      <span className="ml-auto text-xs text-zinc-500">
        {t("resultsCount", { count: resultsCount })}
      </span>
    </div>
  );
}
