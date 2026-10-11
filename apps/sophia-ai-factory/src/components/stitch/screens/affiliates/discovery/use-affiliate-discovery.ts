'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import type { AffiliateOffer } from '@/seed/types/affiliate';
import { getAffiliateOffersAction } from '@/forest/actions/affiliate-actions';
import type { SortOption } from './types';

export function useAffiliateDiscovery(initialOffers?: AffiliateOffer[]) {
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

  return {
    selectedCategory,
    setSelectedCategory,
    selectedPayoutModel,
    setSelectedPayoutModel,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    offers,
    isLoading,
    selectedOffer,
    setSelectedOffer,
    filteredOffers,
    handleResetFilters,
  };
}
