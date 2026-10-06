'use client';

import React, { useState } from 'react';
import { Search, Mail, Plus, MoreVertical, TrendingUp, Sparkles, Users, DollarSign, Clock } from 'lucide-react';
import { DashboardLayout, StatCard, Button, Badge, Table, Avatar } from '@/components/stitch';
import { cn } from '@/seed/utils/cn';
import { AffiliateDiscoveryPanel } from './affiliate-discovery-panel';
import { mockAffiliates, type MockAffiliate } from './mock-affiliates';

export interface AffiliatesPageProps {
  initialAffiliates?: MockAffiliate[];
  stats?: {
    total?: number;
    active?: number;
    totalCommission?: string;
    pendingCommission?: string;
  };
}

export default function AffiliatesPage({ initialAffiliates, stats }: AffiliatesPageProps = {}) {
  const [activeTab, setActiveTab] = useState<'partners' | 'discovery'>('partners');
  const [search, setSearch] = useState('');

  const affiliatesList = initialAffiliates ?? mockAffiliates;
  const filteredAffiliates = affiliatesList.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalCount = stats?.total ?? affiliatesList.length;
  const activeCount = stats?.active ?? affiliatesList.filter((a) => a.status === 'active').length;
  const totalCommission = stats?.totalCommission ?? '$0';
  const pendingCommission = stats?.pendingCommission ?? '$0';

  return (
    <DashboardLayout
      title="Affiliates"
      subtitle="Manage your affiliate partners and track commissions"
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant={activeTab === 'discovery' ? 'primary' : 'outline'}
            onClick={() => setActiveTab(activeTab === 'discovery' ? 'partners' : 'discovery')}
            iconLeft={<Sparkles className="w-4 h-4" />}
          >
            {activeTab === 'discovery' ? 'View Partners' : 'Discover Offers'}
          </Button>
          {activeTab === 'partners' && (
            <Button iconLeft={<Plus className="w-4 h-4" />}>
              Invite Affiliate
            </Button>
          )}
        </div>
      }
    >
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/[0.08] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('partners')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all',
            activeTab === 'partners'
              ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm shadow-primary/10'
              : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]'
          )}
        >
          <Users className="w-4 h-4" />
          <span>Affiliate Partners</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('discovery')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all',
            activeTab === 'discovery'
              ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-sm shadow-primary/10'
              : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]'
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Offer Discovery</span>
        </button>
      </div>

      {activeTab === 'discovery' ? (
        <AffiliateDiscoveryPanel />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Affiliates"
              value={totalCount}
              icon={TrendingUp}
              iconColor="indigo"
            />
            <StatCard
              label="Active"
              value={activeCount}
              icon={Users}
              iconColor="emerald"
            />
            <StatCard
              label="Total Commission"
              value={totalCommission}
              icon={DollarSign}
              iconColor="violet"
            />
            <StatCard
              label="Pending"
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
                placeholder="Search affiliates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 text-sm rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60 transition-all font-sans"
              />
            </div>
            <Button variant="outline" size="md" iconLeft={<Mail className="w-4 h-4" />} className="w-full sm:w-auto">
              Email All
            </Button>
          </div>

          {/* Affiliates List */}
          <Table
            data={filteredAffiliates}
            stickyFirstColumn
            emptyMessage="No affiliate partners registered yet. Use 'Discover Offers' to source high-converting affiliate campaigns or invite partners."
            columns={[
              {
                key: 'affiliate',
                header: 'Affiliate',
                cell: (row) => (
                  <div className="flex items-center gap-3">
                    <Avatar src={row.avatar} alt={row.name} initials={row.name} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (row) => (
                  <Badge variant="soft" color={row.status === 'active' ? 'success' : 'warning'}>
                    {row.status}
                  </Badge>
                ),
                align: 'center',
              },
              {
                key: 'sales',
                header: 'Sales',
                cell: (row) => (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{row.totalSales}</p>
                    <p className="text-xs text-muted-foreground">orders</p>
                  </div>
                ),
                align: 'right',
              },
              {
                key: 'commission',
                header: 'Commission',
                cell: (row) => (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{row.totalCommission}</p>
                    <p className="text-xs text-muted-foreground">earned</p>
                  </div>
                ),
                align: 'right',
              },
              {
                key: 'pending',
                header: 'Pending',
                cell: (row) => (
                  <span className="text-sm font-semibold text-amber-400">{row.pending}</span>
                ),
                align: 'right',
              },
              {
                key: 'actions',
                header: '',
                cell: () => (
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                ),
                align: 'right',
              },
            ]}
            getRowId={(row) => row.id}
          />
        </>
      )}
    </DashboardLayout>
  );
}
