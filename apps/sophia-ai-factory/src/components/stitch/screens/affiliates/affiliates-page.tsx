'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Mail, Plus, Sparkles, TrendingUp, Users, DollarSign, Clock } from 'lucide-react';
import { DashboardLayout, StatCard, Button, Table } from '@/components/stitch';
import { cn } from '@/seed/utils/cn';
import { AffiliateDiscoveryPanel } from './affiliate-discovery-panel';
import { InviteAffiliateModal } from './invite-affiliate-modal';
import { mockAffiliates, type MockAffiliate } from './mock-affiliates';
import { getAffiliatesTableColumns } from './affiliates-table-columns';

export interface AffiliatesPageProps {
  initialAffiliates?: MockAffiliate[];
  stats?: {
    total?: number;
    active?: number;
    totalCommission?: string;
    pendingCommission?: string;
  };
  initialStats?: {
    total?: number;
    active?: number;
    totalCommission?: string;
    pendingCommission?: string;
  };
}

export default function AffiliatesPage({
  initialAffiliates,
  stats,
  initialStats,
}: AffiliatesPageProps = {}) {
  const t = useTranslations('stitch.affiliates');
  const [activeTab, setActiveTab] = useState<'partners' | 'discovery'>('partners');
  const [search, setSearch] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [liveStats, setLiveStats] = useState<{
    total?: number;
    active?: number;
    totalCommission?: string;
    pendingCommission?: string;
  } | null>(null);

  // Fetch live stats from Cloudflare D1 via API endpoint when not pre-provided
  useEffect(() => {
    if (stats || initialStats) return;

    let isMounted = true;
    fetch('/api/affiliates/stats')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json() as Promise<{
          success?: boolean;
          stats?: {
            totalAffiliates?: number;
            activeAffiliates?: number;
            totalCommissionCents?: number;
            pendingCommissionCents?: number;
          };
        }>;
      })
      .then((data) => {
        if (isMounted && data?.success && data?.stats) {
          const s = data.stats;
          const totalComm = s.totalCommissionCents != null
            ? `$${((s.totalCommissionCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '$0.00';
          const pendComm = s.pendingCommissionCents != null
            ? `$${((s.pendingCommissionCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '$0.00';

          setLiveStats({
            total: s.totalAffiliates,
            active: s.activeAffiliates,
            totalCommission: totalComm,
            pendingCommission: pendComm,
          });
        }
      })
      .catch(() => {
        // Non-fatal, fallback to local counts
      });

    return () => {
      isMounted = false;
    };
  }, [stats, initialStats]);

  const affiliatesList = initialAffiliates ?? mockAffiliates;
  const filteredAffiliates = affiliatesList.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase())
  );

  const effectiveStats = stats || initialStats || liveStats;
  const totalCount = effectiveStats?.total ?? affiliatesList.length;
  const activeCount = effectiveStats?.active ?? affiliatesList.filter((a) => a.status === 'active').length;
  const totalCommission = effectiveStats?.totalCommission ?? '$0.00';
  const pendingCommission = effectiveStats?.pendingCommission ?? '$0.00';

  const columns = getAffiliatesTableColumns({
    affiliateHeader: t('columns.affiliate'),
    statusHeader: t('columns.status'),
    salesHeader: t('columns.sales'),
    commissionHeader: t('columns.commission'),
    pendingHeader: t('columns.pending'),
    ordersLabel: t('orders'),
    earnedLabel: t('earned'),
    actionsAriaLabel: t('affiliateActions'),
  });

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant={activeTab === 'discovery' ? 'primary' : 'outline'}
            onClick={() => setActiveTab(activeTab === 'discovery' ? 'partners' : 'discovery')}
            iconLeft={<Sparkles className="w-4 h-4" />}
          >
            {activeTab === 'discovery' ? t('viewPartners') : t('discoverOffers')}
          </Button>
          {activeTab === 'partners' && (
            <Button
              iconLeft={<Plus className="w-4 h-4" />}
              onClick={() => setIsInviteModalOpen(true)}
            >
              {t('inviteAffiliate')}
            </Button>
          )}
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div
        className="flex items-center gap-2 mb-6 border-b border-white/[0.08] pb-3"
        role="tablist"
        aria-label={t('partnersTab')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'partners'}
          aria-controls="affiliates-partners-tab"
          id="affiliates-partners-tab-btn"
          onClick={() => setActiveTab('partners')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            activeTab === 'partners'
              ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm shadow-primary/10'
              : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]'
          )}
        >
          <Users className="w-4 h-4" />
          <span>{t('partnersTab')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'discovery'}
          aria-controls="affiliates-discovery-tab"
          id="affiliates-discovery-tab-btn"
          onClick={() => setActiveTab('discovery')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            activeTab === 'discovery'
              ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm shadow-primary/10'
              : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]'
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('discoveryTab')}</span>
        </button>
      </div>

      {activeTab === 'discovery' ? (
        <div id="affiliates-discovery-tab" role="tabpanel" aria-labelledby="affiliates-discovery-tab-btn">
          <AffiliateDiscoveryPanel />
        </div>
      ) : (
        <div id="affiliates-partners-tab" role="tabpanel" aria-labelledby="affiliates-partners-tab-btn">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label={t('totalAffiliates')}
              value={totalCount}
              icon={TrendingUp}
              iconColor="indigo"
            />
            <StatCard
              label={t('active')}
              value={activeCount}
              icon={Users}
              iconColor="emerald"
            />
            <StatCard
              label={t('totalCommission')}
              value={totalCommission}
              icon={DollarSign}
              iconColor="violet"
            />
            <StatCard
              label={t('pending')}
              value={pendingCommission}
              icon={Clock}
              iconColor="amber"
            />
          </div>

          {/* Search Row */}
          <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-card/85 dark:bg-[#12141F]/80 backdrop-blur-xl border border-border dark:border-white/[0.08]">
            <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-sm rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60 transition-all font-sans"
              />
            </div>
            <Button variant="outline" size="md" iconLeft={<Mail className="w-4 h-4" />} className="w-full sm:w-auto">
              {t('emailAll')}
            </Button>
          </div>

          {/* Affiliates List */}
          <Table
            data={filteredAffiliates}
            stickyFirstColumn
            emptyMessage={t('emptyMessage')}
            columns={columns}
            getRowId={(row) => row.id}
          />
        </div>
      )}

      {/* Invite Affiliate Modal */}
      <InviteAffiliateModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </DashboardLayout>
  );
}
