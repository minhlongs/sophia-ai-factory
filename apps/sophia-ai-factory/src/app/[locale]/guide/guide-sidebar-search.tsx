"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { cn } from '@/seed/utils/cn';

type GuideLink = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
};

type GuideSection = {
  headingKey: string;
  links: GuideLink[];
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function GuideSidebarSearch({
  sections,
  onLinkClick,
}: {
  sections: GuideSection[];
  onLinkClick?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("landing");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Strip locale prefix for matching
  const cleanPath = (pathname ?? "").replace(/^\/(en|vi)/, "");

  const isActive = (href: string) => {
    if (href === "/guide") return cleanPath === "/guide";
    return cleanPath === href || cleanPath.startsWith(href + "/");
  };

  const filteredSections = useMemo(() => {
    if (!debouncedQuery.trim()) return sections;

    const query = debouncedQuery.trim().toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        links: section.links.filter((link) => {
          const label = t(`guide.sidebar.${link.labelKey}`);
          return label.toLowerCase().includes(query);
        }),
      }))
      .filter((section) => section.links.length > 0);
  }, [sections, debouncedQuery, t]);

  const hasResults = filteredSections.length > 0;

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-4 px-3">
        <Search
          className="pointer-events-none absolute left-[18px] top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("guide.sidebar.search_placeholder")}
          aria-label={t("guide.sidebar.search_placeholder")}
          className="w-full rounded-lg border border-border/40 bg-muted/30 px-9 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/20 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-[18px] top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            aria-label="Clear search"
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Filtered nav links */}
      {hasResults ? (
        filteredSections.map((section) => (
          <div key={section.headingKey} className="pb-4">
            <div className="px-3 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                {t(`guide.sidebar.section_${section.headingKey}`)}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onLinkClick}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                      active
                        ? "border-primary-500/30 bg-primary-500/10 text-primary-300 shadow-[0_0_10px_0px_rgba(139,92,246,0.15)]"
                        : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <link.icon
                      className={cn("h-4 w-4 shrink-0", active ? "text-primary-400" : "")}
                      aria-hidden="true"
                    />
                    {t(`guide.sidebar.${link.labelKey}`)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div className="px-3 py-8 text-center">
          <p className="text-sm text-muted-foreground/60">
            {t("guide.sidebar.search_no_results")}
          </p>
        </div>
      )}
    </div>
  );
}
