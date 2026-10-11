'use client';

import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  Search,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { Badge } from '@/components/stitch';
import type { SortOption } from './types';
import { CATEGORIES, PAYOUT_MODELS, SORT_OPTIONS } from './constants';

interface DiscoveryHeaderProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  selectedPayoutModel: string;
  onSelectPayoutModel: (model: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  t: (key: string) => string;
}

export function DiscoveryHeader({
  selectedCategory,
  onSelectCategory,
  selectedPayoutModel,
  onSelectPayoutModel,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  t,
}: DiscoveryHeaderProps) {
  return (
    <div className="rounded-2xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-border dark:border-white/[0.08] p-5 sm:p-6 shadow-lg shadow-black/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>{t('title')}</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="soft" color="success" className="flex items-center gap-1.5 py-1.5 px-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{t('scamGated')}</span>
          </Badge>
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="mt-5 pt-4 border-t border-border dark:border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            role="searchbox"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-10 pr-10 text-sm rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground dark:hover:text-white p-1 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
          <select
            aria-label={t('sort.label')}
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="h-10 px-3.5 text-sm rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all cursor-pointer font-sans"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-card dark:bg-[#12141F] text-foreground dark:text-white">
                {t(`sort.${opt.key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Pills Section */}
      <div className="mt-4 pt-4 border-t border-border dark:border-white/[0.06] space-y-3">
        {/* Category Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 sm:w-28">
            {t('categories.label')}:
          </span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('categories.label')}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.id.toLowerCase();
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-primary text-on-primary font-bold shadow-sm shadow-primary/20'
                      : 'bg-black/[0.04] dark:bg-white/[0.04] text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  {t(`categories.${cat.key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payout Model Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 sm:w-28">
            {t('payoutModels.label')}:
          </span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('payoutModels.label')}>
            {PAYOUT_MODELS.map((model) => {
              const isSelected = selectedPayoutModel.toLowerCase() === model.id.toLowerCase();
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => onSelectPayoutModel(model.id)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-secondary text-on-secondary font-bold shadow-sm shadow-secondary/20'
                      : 'bg-black/[0.04] dark:bg-white/[0.04] text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  {t(`payoutModels.${model.key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
