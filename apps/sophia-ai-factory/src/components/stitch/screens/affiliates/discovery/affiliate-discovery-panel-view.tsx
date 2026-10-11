'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { AffiliateOfferCard } from '../affiliate-offer-card';
import { AffiliateOfferDrawer } from '../affiliate-offer-drawer';
import { DiscoveryHeader } from './discovery-header';
import { DiscoveryEmptyState } from './discovery-empty-state';
import { useAffiliateDiscovery } from './use-affiliate-discovery';
import type { AffiliateDiscoveryPanelProps } from './types';

export function AffiliateDiscoveryPanel({ initialOffers }: AffiliateDiscoveryPanelProps = {}) {
  const t = useTranslations('stitch.affiliates.discovery');

  const {
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
  } = useAffiliateDiscovery(initialOffers);

  return (
    <div className="space-y-6 font-sans">
      <DiscoveryHeader
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selectedPayoutModel={selectedPayoutModel}
        onSelectPayoutModel={setSelectedPayoutModel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        t={t}
      />

      {/* Offers List & Empty State */}
      {isLoading && offers.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredOffers.length === 0 ? (
        <DiscoveryEmptyState onResetFilters={handleResetFilters} t={t} />
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
