'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Search, Calendar, ChevronRight } from 'lucide-react';
import { Input } from '@/components/stitch';

interface CampaignsFilterBarProps {
  searchQuery: string;
  statusFilter: string;
  channelFilter: string;
  onSearch: (value: string) => void;
  onStatusChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onClearFilters: () => void;
}

export function CampaignsFilterBar({
  searchQuery,
  statusFilter,
  channelFilter,
  onSearch,
  onStatusChange,
  onChannelChange,
  onClearFilters,
}: CampaignsFilterBarProps) {
  const t = useTranslations('stitch.campaigns');

  const hasActiveFilters = statusFilter !== 'all' || channelFilter !== 'all' || searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8" role="search" aria-label={t('aria.filterBar')}>
      <div className="relative w-full sm:w-[240px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t('filter.searchPlaceholder')}
          aria-label={t('aria.searchCampaigns')}
          className="pl-10 w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" id="status-filter-label">
          {t('filter.status')}
        </label>
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-10 bg-surface-container-high border border-outline-variant rounded-lg px-3 text-sm text-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60"
          aria-labelledby="status-filter-label"
        >
          <option value="all">{t('filter.all')}</option>
          <option value="live">{t('status.live')}</option>
          <option value="paused">{t('status.paused')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="done">{t('status.done')}</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" id="channel-filter-label">
          {t('filter.channel')}
        </label>
        <select
          value={channelFilter}
          onChange={(e) => onChannelChange(e.target.value)}
          className="h-10 bg-surface-container-high border border-outline-variant rounded-lg px-3 text-sm text-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60"
          aria-labelledby="channel-filter-label"
        >
          <option value="all">{t('filter.all')}</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      <div
        className="flex items-center gap-2 h-10 bg-surface-container-high border border-outline-variant rounded-lg px-3 cursor-pointer hover:border-foreground/30 transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        role="button"
        tabIndex={0}
        aria-label={t('filter.date')}
      >
        <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-foreground">{t('filter.last30Days')}</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground -rotate-90" aria-hidden="true" />
      </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="h-10 px-2 inline-flex items-center text-xs text-primary font-semibold hover:underline transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
          >
            {t('filter.clearAll')}
          </button>
        )}
      </div>
    </div>
  );
}
