'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/stitch';
import { CampaignCard } from './campaign-card';
import { CampaignsEmptyState } from './campaigns-empty-state';
import { CampaignsFilterBar } from './campaigns-filter-bar';
import { CampaignsPagination } from './campaigns-pagination';
import { CampaignsPageFooter } from './campaigns-page-footer';
import { useCampaignsPageState } from './use-campaigns-page-state';
import type { CampaignsPageProps } from './campaigns-page-types';

// Re-export extracted modules for barrel compatibility
export { CampaignCard } from './campaign-card';
export { CampaignsEmptyState } from './campaigns-empty-state';
export { CampaignsFilterBar } from './campaigns-filter-bar';
export { CampaignsPagination } from './campaigns-pagination';
export type { CampaignsPageProps, Campaign, CampaignStatus, CampaignMetric, Channel } from './campaigns-page-types';
export { STATUS_CONFIG, CHANNEL_ICONS, DEFAULT_CAMPAIGNS } from './campaigns-page-types';

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function CampaignsPage({
  initialCampaigns,
  totalCampaigns: totalProp,
  itemsPerPage = 12,
  initialSearchQuery = '',
  onCreateCampaign,
  onSearch,
  onPageChange,
}: CampaignsPageProps) {
  const t = useTranslations('stitch.campaigns');
  const {
    searchQuery, statusFilter, channelFilter, currentPage, totalCampaigns, filtered,
    totalPages, startItem, endItem, paginationButtons,
    handleSearch, handlePageChange, handleStatusChange, handleChannelChange, clearFilters,
  } = useCampaignsPageState({
    initialCampaigns, totalCampaigns: totalProp, itemsPerPage, initialSearchQuery, onSearch, onPageChange,
  });

  const isEmpty = filtered.length === 0;
  const handleCreateCampaign = () => {
    if (onCreateCampaign) {
      onCreateCampaign();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/dashboard/campaigns/new';
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-foreground dark:text-white tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button
          onClick={handleCreateCampaign}
          variant="primary"
          className="bg-primary hover:bg-primary/90 shadow-sm text-white hover:text-white"
        >
          <Plus className="w-5 h-5 mr-2" aria-hidden="true" />
          {t('actions.createCampaign')}
        </Button>
      </div>

      {/* Filter Bar */}
      <CampaignsFilterBar
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        channelFilter={channelFilter}
        onSearch={handleSearch}
        onStatusChange={handleStatusChange}
        onChannelChange={handleChannelChange}
        onClearFilters={clearFilters}
      />

      {/* Content */}
      {isEmpty ? (
        <CampaignsEmptyState t={(k) => t(k)} onCreateCampaign={handleCreateCampaign} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} t={(k) => t(k)} />
            ))}
          </div>

          <CampaignsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCampaigns={totalCampaigns}
            startItem={startItem}
            endItem={endItem}
            paginationButtons={paginationButtons}
            onPageChange={handlePageChange}
          />
        </>
      )}

      <CampaignsPageFooter t={(k) => t(k)} />
    </div>
  );
}
