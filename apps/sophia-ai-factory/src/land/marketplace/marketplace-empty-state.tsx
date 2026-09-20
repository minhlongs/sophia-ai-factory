'use client';

/**
 * Empty State for Zero Search Results in Marketplace
 *
 * Layer: land (pure UI component)
 *
 * @module land/marketplace/marketplace-empty-state
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { SearchX, RotateCcw } from 'lucide-react';

export function MarketplaceEmptyState() {
  const t = useTranslations('blueprintMarketplace');
  const router = useRouter();
  const pathname = usePathname();

  const handleClearFilters = () => {
    router.push(pathname);
  };

  return (
    <div className="my-12 flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#12131A]/50 p-8 md:p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
        <SearchX className="h-8 w-8" />
      </div>

      <h3 className="text-lg font-bold text-foreground sm:text-xl">
        {t('empty.title')}
      </h3>

      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t('empty.description')}
      </p>

      <button
        type="button"
        onClick={handleClearFilters}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/15 transition"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t('empty.clearAction')}
      </button>
    </div>
  );
}
