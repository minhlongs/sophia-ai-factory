'use client';

/**
 * SopFilters — category dropdown + keyword search for the SOP marketplace.
 *
 * Controlled purely client-side (no URL search params in Phase 1).
 * Notifies parent via onChange callbacks.
 */

import { useTranslations } from 'next-intl';
import type { SopTemplateRow } from '@/lib/sop/sop-types';
import { Search } from 'lucide-react';

type Category = SopTemplateRow['category'] | 'all';

interface SopFiltersProps {
  category: Category;
  query: string;
  onCategoryChange: (v: Category) => void;
  onQueryChange: (v: string) => void;
}

const CATEGORIES: Array<{ value: Category; labelKey: string }> = [
  { value: 'all',       labelKey: 'filterAll' },
  { value: 'content',   labelKey: 'content' },
  { value: 'leads',     labelKey: 'leads' },
  { value: 'email',     labelKey: 'email' },
  { value: 'analytics', labelKey: 'analytics' },
  { value: 'proposals', labelKey: 'proposals' },
  { value: 'crisis',    labelKey: 'crisis' },
];

export function SopFilters({ category, query, onCategoryChange, onQueryChange }: SopFiltersProps) {
  const tm = useTranslations('sop.marketplace');
  const tc = useTranslations('sop.categories');

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Category selector */}
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as Category)}
        className="px-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
        aria-label={tm('filterCategory')}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.value === 'all' ? tm('filterAll') : tc(c.value)}
          </option>
        ))}
      </select>

      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={tm('searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>
    </div>
  );
}
