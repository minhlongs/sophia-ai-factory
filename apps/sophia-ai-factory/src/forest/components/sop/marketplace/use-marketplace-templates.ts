"use client";

import { useState, useEffect, useMemo } from "react";
import {
  type MarketplaceTemplate,
  type SortKey,
  extractCategories,
} from "./types";

interface UseMarketplaceTemplatesInput {
  initialTemplates?: MarketplaceTemplate[];
  initialCategory?: string;
  fetchUrl?: string;
}

interface UseMarketplaceTemplatesOutput {
  templates: MarketplaceTemplate[];
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  category: string;
  setCategory: React.Dispatch<React.SetStateAction<string>>;
  sort: SortKey;
  setSort: React.Dispatch<React.SetStateAction<SortKey>>;
  allCategories: string[];
  filtered: MarketplaceTemplate[];
}

export function useMarketplaceTemplates({
  initialTemplates,
  initialCategory,
  fetchUrl,
}: UseMarketplaceTemplatesInput): UseMarketplaceTemplatesOutput {
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>(
    initialTemplates ?? [],
  );
  const [loading, setLoading] = useState(!initialTemplates);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "all");
  const [sort, setSort] = useState<SortKey>("popular");

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

  const allCategories = useMemo(
    () => ["all", ...extractCategories(templates)],
    [templates],
  );

  const filtered = useMemo(() => {
    let list = templates;
    if (category !== "all") {
      list = list.filter((item) => item.category === category);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    if (sort === "popular") {
      list = [...list].sort((a, b) => b.totalSales - a.totalSales);
    } else if (sort === "rating") {
      list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg);
    }
    return list;
  }, [templates, category, query, sort]);

  return {
    templates,
    loading,
    error,
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    allCategories,
    filtered,
  };
}