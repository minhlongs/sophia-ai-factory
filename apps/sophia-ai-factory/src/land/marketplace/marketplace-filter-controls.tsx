// i18n-namespace: blueprintMarketplace
'use client';

import React from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';

export function MarketplaceSelectControlsRow({
  currentPlatform,
  currentCvr,
  currentSort,
  activeCount,
  updateParam,
  handleReset,
  t,
}: {
  currentPlatform: string;
  currentCvr: string;
  currentSort: string;
  activeCount: number;
  updateParam: (key: string, value: string) => void;
  handleReset: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t('platformLabel')}:</span>
          <select
            value={currentPlatform}
            onChange={(e) => updateParam('platform', e.target.value)}
            className="rounded-lg border border-white/10 bg-[#161822] px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">{t('platforms.all')}</option>
            <option value="tiktok">{t('platforms.tiktok')}</option>
            <option value="youtube_shorts">{t('platforms.youtube_shorts')}</option>
            <option value="x">{t('platforms.x')}</option>
            <option value="instagram_reels">{t('platforms.instagram_reels')}</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t('conversionLabel')}:</span>
          <select
            value={currentCvr}
            onChange={(e) => updateParam('minConversionRate', e.target.value)}
            className="rounded-lg border border-white/10 bg-[#161822] px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">{t('conversions.all')}</option>
            <option value="0.03">{t('conversions.gt3')}</option>
            <option value="0.05">{t('conversions.gt5')}</option>
            <option value="0.10">{t('conversions.gt10')}</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" />
            {t('sortLabel')}:
          </span>
          <select
            value={currentSort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="rounded-lg border border-white/10 bg-[#161822] px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
          >
            <option value="highest_conversion">{t('sortOptions.highest_conversion')}</option>
            <option value="most_remixed">{t('sortOptions.most_remixed')}</option>
            <option value="newest">{t('sortOptions.newest')}</option>
          </select>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
            {t('activeFiltersCount', { count: activeCount })}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <RotateCcw className="h-3 w-3" />
            {t('resetFilters')}
          </button>
        </div>
      )}
    </div>
  );
}
