'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Search,
  Calendar,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Camera,
  Video,
  Clapperboard,
} from 'lucide-react';
import {
  Badge,
  Button,
  Input,
} from '@/components/stitch';
import { cn } from '@/seed/utils/cn';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CampaignStatus = 'live' | 'paused' | 'draft';
type Channel = 'youtube' | 'instagram' | 'tiktok';

interface CampaignMetric {
  views: string;
  revenue: string;
  ctr: string;
}

interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  channel: string;
  channels: Channel[];
  thumbnail: string | null;
  metrics: CampaignMetric;
  progress: number;
  progressLabel: string;
  lastPublished: string;
  action: string;
  actionLabel: string;
}

export interface CampaignsPageProps {
  /** Pre-populated campaigns list (SSR data) */
  initialCampaigns?: Campaign[];
  /** Total number of campaigns for pagination */
  totalCampaigns?: number;
  /** Items per page */
  itemsPerPage?: number;
  /** Current search query (initial) */
  initialSearchQuery?: string;
  /** Callback when creating a new campaign */
  onCreateCampaign?: () => void;
  /** Callback when searching */
  onSearch?: (query: string) => void;
  /** Callback when changing page */
  onPageChange?: (page: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<CampaignStatus, { color: 'success' | 'warning' | 'neutral'; labelKey: string }> = {
  live: { color: 'success', labelKey: 'status.live' },
  paused: { color: 'warning', labelKey: 'status.paused' },
  draft: { color: 'neutral', labelKey: 'status.draft' },
};

/* ------------------------------------------------------------------ */
/*  Channel icon map                                                   */
/* ------------------------------------------------------------------ */

const CHANNEL_ICONS: Record<Channel, React.ComponentType<{ className?: string; 'aria-label'?: string }>> = {
  youtube: MonitorPlay,
  instagram: Camera,
  tiktok: Video,
};

/* ------------------------------------------------------------------ */
/*  Default sample data (UI demo / fallback)                           */
/* ------------------------------------------------------------------ */

const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    title: 'Summer Vibes 2024',
    status: 'live',
    channel: 'Faceless YouTube',
    channels: ['youtube', 'instagram'],
    thumbnail: null,
    metrics: { views: '12.4K', revenue: '$847', ctr: '3.2%' },
    progress: 85,
    progressLabel: 'Campaign Progress',
    lastPublished: '2 hours ago',
    action: 'View Details',
    actionLabel: 'viewDetails',
  },
  {
    id: '2',
    title: 'Tech Review Weekly',
    status: 'paused',
    channel: 'Affiliate',
    channels: ['youtube'],
    thumbnail: null,
    metrics: { views: '4.1K', revenue: '$212', ctr: '1.8%' },
    progress: 40,
    progressLabel: 'Campaign Progress',
    lastPublished: '1 day ago',
    action: 'View Details',
    actionLabel: 'viewDetails',
  },
  {
    id: '3',
    title: 'Daily Stoicism',
    status: 'draft',
    channel: 'Motivational',
    channels: [],
    thumbnail: null,
    metrics: { views: '-', revenue: '-', ctr: '-' },
    progress: 12,
    progressLabel: 'Generation Progress',
    lastPublished: '3 hours ago',
    action: 'Continue Draft',
    actionLabel: 'continueDraft',
  },
];

/* ------------------------------------------------------------------ */
/*  CampaignCard sub-component                                         */
/* ------------------------------------------------------------------ */

function CampaignCard({
  campaign,
  t,
}: {
  campaign: Campaign;
  t: (key: string) => string;
}) {
  const statusCfg = STATUS_CONFIG[campaign.status];
  const hasMetrics = campaign.metrics.views !== '-';

  const badgeClass = campaign.status === 'live'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : campaign.status === 'paused'
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';

  return (
    <div
      className={cn(
        'glass-card rounded-lg',
        'p-4 flex flex-col gap-4',
        'group hover:ring-1 hover:ring-brand-indigo/50 transition-all duration-200',
        !hasMetrics && 'opacity-80'
      )}
      role="article"
      aria-label={campaign.title}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white group-hover:text-brand-indigo transition-colors truncate">
            {campaign.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="soft" color={statusCfg.color} size="sm" className={badgeClass}>
              {t(statusCfg.labelKey)}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {campaign.channel}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label={t('aria.moreOptions') + ' ' + campaign.title}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Thumbnail placeholder */}
      <div
        className={cn(
          'relative rounded-lg overflow-hidden h-32 w-full',
          !campaign.thumbnail && 'bg-muted'
        )}
      >
        {campaign.thumbnail ? (
          <img
            src={campaign.thumbnail}
            alt=""
            className="w-full h-full object-cover brightness-75 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center opacity-40">
              <Clapperboard className="w-10 h-10 mb-2 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{t('placeholder.thumbnail')}</span>
            </div>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        {/* Channel icons */}
        {campaign.channels.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1" aria-label={t('aria.channelIcons')}>
            {campaign.channels.map((ch) => {
              const Icon = CHANNEL_ICONS[ch];
              return (
                <Icon
                  key={ch}
                  className="text-white text-base"
                  aria-label={ch}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 border-y border-border py-3">
        <MetricCell label={t('metrics.views')} value={campaign.metrics.views} muted={!hasMetrics} />
        <MetricCell label={t('metrics.revenue')} value={campaign.metrics.revenue} muted={!hasMetrics} />
        <MetricCell label={t('metrics.ctr')} value={campaign.metrics.ctr} muted={!hasMetrics} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-medium">
          <span className="text-muted-foreground">{t('progress.' + (campaign.progressLabel === 'Generation Progress' ? 'generation' : 'campaign'))}</span>
          <span className="text-foreground">{campaign.progress}%</span>
        </div>
        <div
          className="w-full h-1.5 bg-muted rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={campaign.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${campaign.progress}% ${t('progress.aria')}`}
        >
          <div
            className="h-full bg-brand-indigo rounded-full transition-all duration-500"
            style={{ width: `${campaign.progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[11px] text-muted-foreground">
          {t('lastPublished') + ' ' + campaign.lastPublished}
        </span>
        <button
          type="button"
          className="text-brand-indigo text-[11px] font-bold hover:underline transition-colors"
        >
          {t('actions.' + campaign.actionLabel)}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MetricCell sub-component                                           */
/* ------------------------------------------------------------------ */

function MetricCell({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
        {label}
      </p>
      <p className={cn('text-sm font-bold', muted ? 'text-muted-foreground' : 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EmptyState sub-component                                           */
/* ------------------------------------------------------------------ */

function CampaignsEmptyState({ t, onCreateCampaign }: { t: (key: string) => string; onCreateCampaign?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="relative mb-6">
        <div className="w-32 h-32 bg-brand-indigo/10 rounded-full flex items-center justify-center">
          <Video className="w-16 h-16 text-brand-indigo/50" aria-hidden="true" />
        </div>
        <div className="absolute -top-2 -right-2 w-10 h-10 bg-card border border-border rounded-lg flex items-center justify-center shadow-xl">
          <Plus className="text-brand-indigo text-xl" aria-hidden="true" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {t('emptyState.title')}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">
        {t('emptyState.description')}
      </p>
      <Button
        onClick={onCreateCampaign}
        className="bg-brand-indigo hover:bg-indigo-500 text-white shadow-lg shadow-brand-indigo/20 hover:text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        {t('emptyState.cta')}
      </Button>
    </div>
  );
}

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

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Channel filter
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

  const hasActiveFilters = statusFilter !== 'all' || channelFilter !== 'all' || searchQuery.trim().length > 0;

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
          className="bg-brand-indigo hover:bg-indigo-500 shadow-lg shadow-brand-indigo/20 text-white hover:text-white"
        >
          <Plus className="w-5 h-5 mr-2" aria-hidden="true" />
          {t('actions.createCampaign')}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-8" role="search" aria-label={t('aria.filterBar')}>
        {/* Search */}
        <div className="relative w-full sm:w-[240px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('aria.searchCampaigns')}
            className="pl-10"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" id="status-filter-label">
            {t('filter.status')}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
            aria-labelledby="status-filter-label"
          >
            <option value="all">{t('filter.all')}</option>
            <option value="live">{t('status.live')}</option>
            <option value="paused">{t('status.paused')}</option>
            <option value="draft">{t('status.draft')}</option>
          </select>
        </div>

        {/* Channel filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" id="channel-filter-label">
            {t('filter.channel')}
          </label>
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setCurrentPage(1); }}
            className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-indigo/30"
            aria-labelledby="channel-filter-label"
          >
            <option value="all">{t('filter.allChannels')}</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>

        {/* Date filter */}
        <div
          className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 cursor-pointer hover:border-foreground/30 transition-colors"
          role="button"
          tabIndex={0}
          aria-label={t('filter.date')}
        >
          <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-foreground">{t('filter.last30Days')}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground -rotate-90" aria-hidden="true" />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            {t('filter.clear')}
          </button>
        )}
      </div>

      {/* Content: Campaign grid or empty state */}
      {isEmpty ? (
        <CampaignsEmptyState t={t} onCreateCampaign={onCreateCampaign} />
      ) : (
        <>
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            }}
            role="list"
            aria-label={t('aria.campaignList')}
          >
            {filtered.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} t={t} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex flex-col md:flex-row items-center justify-between border-t border-border pt-8 pb-12 gap-4">
              <p className="text-sm text-muted-foreground">
                {t('pagination.showing', { from: startItem, to: endItem, total: totalCampaigns })}
              </p>
              <nav className="flex items-center gap-1" aria-label={t('aria.pagination')}>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none"
                  aria-label={t('aria.previousPage')}
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>

                {paginationButtons.map((btn, idx) =>
                  btn === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground" aria-hidden="true">
                      ...
                    </span>
                  ) : (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handlePageChange(btn)}
                      aria-current={btn === currentPage ? 'page' : undefined}
                      aria-label={t('aria.page', { page: btn })}
                      className={cn(
                        'w-10 h-10 rounded-lg font-bold text-sm transition-all',
                        btn === currentPage
                          ? 'bg-brand-indigo text-white shadow-lg shadow-brand-indigo/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-variant'
                      )}
                    >
                      {btn}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none"
                  aria-label={t('aria.nextPage')}
                >
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          )}
        </>
      )}

      {/* Footer branding */}
      <footer className="mt-auto py-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('footer.poweredBy')}</span>
          <span className="text-sm font-bold text-primary">{t('footer.engine')}</span>
        </div>
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
