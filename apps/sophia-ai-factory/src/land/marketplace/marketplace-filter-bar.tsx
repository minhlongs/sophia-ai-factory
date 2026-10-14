'use client';

/**
 * Reactive Faceted Filtering Bar for Marketplace Discovery
 *
 * Layer: land (pure client UI component)
 *
 * @module land/marketplace/marketplace-filter-bar
 */

import React, { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { useSearchParams } from 'next/navigation';
import { Search, Filter } from 'lucide-react';
import type { MarketplaceFilters } from '@/seed/types/creator-marketplace';
import { MarketplaceSelectControlsRow } from './marketplace-filter-controls';

export interface MarketplaceFilterBarProps {
  initialFilters?: MarketplaceFilters;
}

export function MarketplaceFilterBar({ initialFilters }: MarketplaceFilterBarProps) {
  const t = useTranslations('blueprintMarketplace');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentSearch = searchParams.get('search') || initialFilters?.search || '';
  const currentNiche = searchParams.get('niche') || initialFilters?.niche || 'all';
  const currentPlatform = searchParams.get('platform') || initialFilters?.platform || 'all';
  const currentCvr = searchParams.get('minConversionRate') || (initialFilters?.minConversionRate ? String(initialFilters.minConversionRate) : 'all');
  const currentSort = searchParams.get('sort') || initialFilters?.sort || 'highest_conversion';

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Count active non-default filters
  let activeCount = 0;
  if (currentSearch.trim()) activeCount++;
  if (currentNiche && currentNiche !== 'all') activeCount++;
  if (currentPlatform && currentPlatform !== 'all') activeCount++;
  if (currentCvr && currentCvr !== 'all') activeCount++;
  if (currentSort && currentSort !== 'highest_conversion') activeCount++;

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set('page', '1'); // Reset to page 1 on filter change
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam('search', searchTerm.trim());
  };

  const handleReset = () => {
    setSearchTerm('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const niches = [
    { key: 'all', label: t('niches.all') },
    { key: 'ecommerce', label: t('niches.ecommerce') },
    { key: 'saas', label: t('niches.saas') },
    { key: 'fitness', label: t('niches.fitness') },
    { key: 'education', label: t('niches.education') },
    { key: 'finance', label: t('niches.finance') },
    { key: 'entertainment', label: t('niches.entertainment') },
    { key: 'general', label: t('niches.general') },
  ];

  return (
    <div className="mb-8 space-y-4 rounded-2xl border border-white/10 bg-[#12131A]/80 p-4 md:p-6 backdrop-blur-md shadow-xl">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-24 text-sm text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
        />
        <button
          type="submit"
          className="absolute right-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
        >
          {t('filtersTitle')}
        </button>
      </form>

      {/* Niche Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-medium text-muted-foreground shrink-0 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" />
          {t('nicheLabel')}:
        </span>
        {niches.map((n) => (
          <button
            key={n.key}
            type="button"
            onClick={() => updateParam('niche', n.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
              currentNiche === n.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white/[0.05] text-muted-foreground hover:bg-white/10 hover:text-foreground'
            }`}
          >
            {n.label}
          </button>
        ))}
      </div>

      <MarketplaceSelectControlsRow
        currentPlatform={currentPlatform}
        currentCvr={currentCvr}
        currentSort={currentSort}
        activeCount={activeCount}
        updateParam={updateParam}
        handleReset={handleReset}
        t={t}
      />
    </div>
  );
}
