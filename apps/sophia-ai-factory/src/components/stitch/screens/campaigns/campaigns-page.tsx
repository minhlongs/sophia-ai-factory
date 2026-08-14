'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/stitch';
import { CampaignCard } from './campaign-card';
import { CampaignsEmptyState } from './campaigns-empty-state';
import { CampaignsFilterBar } from './campaigns-filter-bar';
import { CampaignsPagination } from './campaigns-pagination';
import { DEFAULT_CAMPAIGNS } from './campaigns-page-types';
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

  /* State */
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  /* Data */
  const campaigns = initialCampaigns ?? DEFAULT_CAMPAIGNS;
  const totalCampaigns = totalProp ?? campaigns.length;

  /* Filtered campaigns */
  const filtered = useMemo(() => {
    let result = campaigns;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (channelFilter !== 'all') {
      result = result.filter((c) => c.channel.toLowerCase().includes(channelFilter));
    }

    return result;
  }, [campaigns, searchQuery, statusFilter, channelFilter]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(totalCampaigns / itemsPerPage));
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalCampaigns);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    onSearch?.(value);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setChannelFilter('all');
    setCurrentPage(1);
  };

  const isEmpty = filtered.length === 0;

  /* Generate pagination buttons */
  const paginationButtons = useMemo(() => {
    const buttons: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) buttons.push(i);
    } else {
      buttons.push(1);
      if (currentPage > 3) buttons.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        buttons.push(i);
      }
      if (currentPage < totalPages - 2) buttons.push('ellipsis');
      buttons.push(totalPages);
    }
    return buttons;
  }, [totalPages, currentPage]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h2 className="text-[28px] font-bold text-foreground tracking-tight">
            {t('title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button
          onClick={onCreateCampaign}
          variant="primary"
          className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-white hover:text-white"
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
        onStatusChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
        onChannelChange={(v) => { setChannelFilter(v); setCurrentPage(1); }}
        onClearFilters={clearFilters}
      />

      {/* Content */}
      {isEmpty ? (
        <CampaignsEmptyState t={(k) => t(k)} onCreateCampaign={onCreateCampaign} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} t={(k) => t(k)} />
            ))}
          </div>

          {/* Pagination */}
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

      {/* Footer */}
      <footer className="mt-auto pt-8 pb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('footer.copyright')}</span>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t('footer.apiDocs')}
          </a>
          <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t('footer.privacy')}
          </a>
          <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t('footer.terms')}
          </a>
        </div>
      </footer>
    </div>
  );
}
