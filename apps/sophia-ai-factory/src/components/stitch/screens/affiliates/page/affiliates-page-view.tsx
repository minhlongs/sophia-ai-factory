'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Sparkles } from 'lucide-react';
import { DashboardLayout, Button, Table } from '@/components/stitch';
import { AffiliateDiscoveryPanel } from '../affiliate-discovery-panel';
import { InviteAffiliateModal } from '../invite-affiliate-modal';
import { mockAffiliates } from '../mock-affiliates';
import { getAffiliatesTableColumns } from '../affiliates-table-columns';
import { AffiliatesPageProps } from './types';
import { StatHeader } from './stat-header';
import { SearchFilterBar } from './search-filter-bar';
import { useLiveAffiliateStats, AffiliatesTabSwitcher } from './affiliates-page-tabs';

export function AffiliatesPage({
  initialAffiliates,
  stats,
  initialStats,
}: AffiliatesPageProps = {}) {
  const t = useTranslations('stitch.affiliates');
  const [activeTab, setActiveTab] = useState<'partners' | 'discovery'>('partners');
  const [search, setSearch] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const liveStats = useLiveAffiliateStats(stats, initialStats);

  const affiliatesList = initialAffiliates ?? mockAffiliates;
  const filteredAffiliates = affiliatesList.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase()),
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
      <AffiliatesTabSwitcher activeTab={activeTab} onSelectTab={setActiveTab} t={(k) => t(k)} />

      {activeTab === 'discovery' ? (
        <div id="affiliates-discovery-tab" role="tabpanel" aria-labelledby="affiliates-discovery-tab-btn">
          <AffiliateDiscoveryPanel />
        </div>
      ) : (
        <div id="affiliates-partners-tab" role="tabpanel" aria-labelledby="affiliates-partners-tab-btn">
          <StatHeader
            totalCount={totalCount}
            activeCount={activeCount}
            totalCommission={totalCommission}
            pendingCommission={pendingCommission}
          />
          <SearchFilterBar search={search} onSearchChange={setSearch} />
          <Table
            data={filteredAffiliates}
            stickyFirstColumn
            emptyMessage={t('emptyMessage')}
            columns={columns}
            getRowId={(row) => row.id}
          />
        </div>
      )}

      <InviteAffiliateModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </DashboardLayout>
  );
}
