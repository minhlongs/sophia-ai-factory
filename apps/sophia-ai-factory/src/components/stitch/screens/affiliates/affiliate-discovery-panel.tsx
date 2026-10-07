'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Sparkles,
  ShieldCheck,
  Search,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button, Badge } from '@/components/stitch';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import { getAffiliateOffersAction } from '@/forest/actions/affiliate-actions';
import { AffiliateOfferCard } from './affiliate-offer-card';
import { AffiliateOfferDrawer } from './affiliate-offer-drawer';

export interface AffiliateDiscoveryPanelProps {
  initialOffers?: AffiliateOffer[];
}

const CATEGORIES = [
  { id: 'all', key: 'all' },
  { id: 'SaaS', key: 'saas' },
  { id: 'E-Commerce', key: 'ecommerce' },
  { id: 'Creator Tools', key: 'creatorTools' },
  { id: 'Agency Automation', key: 'agencyAutomation' },
] as const;

const PAYOUT_MODELS = [
  { id: 'all', key: 'all' },
  { id: 'RevShare %', key: 'revshare' },
  { id: 'Flat CPA', key: 'cpa' },
  { id: 'Recurring', key: 'recurring' },
] as const;

type SortOption = 'epc' | 'conversion' | 'commission' | 'quality';

const SORT_OPTIONS: Array<{ id: SortOption; key: 'epc' | 'conversionRate' | 'commission' | 'score' }> = [
  { id: 'epc', key: 'epc' },
  { id: 'conversion', key: 'conversionRate' },
  { id: 'commission', key: 'commission' },
  { id: 'quality', key: 'score' },
];

export function AffiliateDiscoveryPanel({ initialOffers }: AffiliateDiscoveryPanelProps = {}) {
  const t = useTranslations('stitch.affiliates.discovery');

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPayoutModel, setSelectedPayoutModel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('epc');

  const [offers, setOffers] = useState<AffiliateOffer[]>(initialOffers ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialOffers);
  const [selectedOffer, setSelectedOffer] = useState<AffiliateOffer | null>(null);
  const [, startTransition] = useTransition();

  // Load offers on mount and when filter criteria change
  useEffect(() => {
    let isMounted = true;
    startTransition(async () => {
      setIsLoading(true);
      const res = await getAffiliateOffersAction({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        payoutModel: selectedPayoutModel !== 'all' ? selectedPayoutModel : undefined,
        search: searchQuery.trim() || undefined,
        sortBy,
        limit: 50,
      });

      if (isMounted) {
        if (res.success && res.offers) {
          setOffers(res.offers);
        } else if (!initialOffers) {
          setOffers([]);
        }
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedCategory, selectedPayoutModel, searchQuery, sortBy, initialOffers]);

  // Synchronous client-side filter & sort layer for instant feedback
  const filteredOffers = useMemo(() => {
    let list = [...offers];

    if (selectedCategory !== 'all') {
      list = list.filter(
        (o) => o.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (selectedPayoutModel !== 'all') {
      list = list.filter(
        (o) => o.payoutModel?.toLowerCase() === selectedPayoutModel.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.programName.toLowerCase().includes(q) ||
          (o.commissionTerms && o.commissionTerms.toLowerCase().includes(q)) ||
          o.category.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'conversion':
        list.sort((a, b) => b.conversionRatePct - a.conversionRatePct);
        break;
      case 'commission':
        list.sort((a, b) => b.commissionRatePct - a.commissionRatePct);
        break;
      case 'quality':
        list.sort((a, b) => b.qualityScore - a.qualityScore);
        break;
      case 'epc':
      default:
        list.sort((a, b) => b.epc - a.epc);
        break;
    }

    return list;
  }, [offers, selectedCategory, selectedPayoutModel, searchQuery, sortBy]);

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedPayoutModel('all');
    setSearchQuery('');
    setSortBy('epc');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Discovery Header Banner */}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-10 text-sm rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
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
              onChange={(e) => setSortBy(e.target.value as SortOption)}
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
                    onClick={() => setSelectedCategory(cat.id)}
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
                    onClick={() => setSelectedPayoutModel(model.id)}
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

      {/* Offers List & Empty State */}
      {isLoading && offers.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredOffers.length === 0 ? (
        <div
          role="region"
          aria-label="Empty State"
          className="text-center py-12 px-4 rounded-2xl bg-card/50 dark:bg-white/[0.02] border border-border dark:border-white/[0.06]"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-foreground dark:text-white">
            {t('emptySearch')}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Try adjusting your category, payout model, or search terms to discover more partner programs.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
            className="mt-4"
            iconLeft={<RotateCcw className="w-4 h-4" />}
          >
            {t('resetFilters')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffers.map((offer) => (
            <AffiliateOfferCard
              key={offer.id}
              offer={offer}
              onViewDetails={(selected) => setSelectedOffer(selected)}
            />
          ))}
        </div>
      )}

      {/* Slide-over Offer Detail & Adoption Drawer */}
      <AffiliateOfferDrawer
        isOpen={Boolean(selectedOffer)}
        offer={selectedOffer}
        onClose={() => setSelectedOffer(null)}
      />
    </div>
  );
}
