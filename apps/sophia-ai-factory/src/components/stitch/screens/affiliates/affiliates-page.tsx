'use client';

import React, { useState } from 'react';
import { Search, Mail, Plus, MoreVertical, TrendingUp, Sparkles, Users } from 'lucide-react';
import { DashboardLayout, Card, Button, Badge, Table, Input, Avatar } from '@/components/stitch';
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
        <div className="flex items-center gap-xs">
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
      <div className="flex items-center gap-xs mb-lg border-b border-outline/10 pb-xs">
        <button
          type="button"
          onClick={() => setActiveTab('partners')}
          className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-md font-medium transition-colors ${
            activeTab === 'partners'
              ? 'bg-primary/10 text-primary font-bold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Affiliate Partners</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('discovery')}
          className={`flex items-center gap-xs px-md py-xs rounded-lg text-label-md font-medium transition-colors ${
            activeTab === 'discovery'
              ? 'bg-primary/10 text-primary font-bold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Offer Discovery</span>
        </button>
      </div>

      {activeTab === 'discovery' ? (
        <AffiliateDiscoveryPanel />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-xl">
            <Card padding="md">
              <div className="flex items-center gap-md">
                <div className="p-sm bg-secondary-container rounded-xl text-secondary">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant">Total Affiliates</p>
                  <p className="font-headline-md text-headline-md text-on-surface">{totalCount}</p>
                </div>
              </div>
            </Card>
            <Card padding="md">
              <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Active</p>
              <p className="font-headline-md text-headline-md text-emerald-600">{activeCount}</p>
            </Card>
            <Card padding="md">
              <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Total Commission</p>
              <p className="font-headline-md text-headline-md text-on-surface">{totalCommission}</p>
            </Card>
            <Card padding="md">
              <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Pending</p>
              <p className="font-headline-md text-headline-md text-amber-600">{pendingCommission}</p>
            </Card>
          </div>

          {/* Search */}
          <Card className="mb-xl" padding="md">
            <div className="flex items-center gap-md">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
                <Input
                  placeholder="Search affiliates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" iconLeft={<Mail className="w-4 h-4" />}>
                Email All
              </Button>
            </div>
          </Card>

          {/* Affiliates List */}
          <Card padding="none">
            <Table
              data={filteredAffiliates}
              emptyMessage="No affiliate partners registered yet. Use 'Discover Offers' to source high-converting affiliate campaigns or invite partners."
              columns={[
                { key: 'affiliate', header: 'Affiliate', cell: (row) => (
                  <div className="flex items-center gap-md">
                    <Avatar src={row.avatar} alt={row.name} initials={row.name} size="md" />
                    <div>
                      <p className="font-label-md text-on-surface">{row.name}</p>
                      <p className="text-[12px] text-on-surface-variant">{row.email}</p>
                    </div>
                  </div>
                ) },
                { key: 'status', header: 'Status', cell: (row) => (
                  <Badge variant="soft" color={row.status === 'active' ? 'success' : 'warning'}>
                    {row.status}
                  </Badge>
                ), align: 'center' },
                { key: 'sales', header: 'Sales', cell: (row) => (
                  <div className="text-right">
                    <p className="font-label-md text-on-surface">{row.totalSales}</p>
                    <p className="text-[12px] text-on-surface-variant">orders</p>
                  </div>
                ), align: 'right' },
                { key: 'commission', header: 'Commission', cell: (row) => (
                  <div className="text-right">
                    <p className="font-label-md text-on-surface">{row.totalCommission}</p>
                    <p className="text-[12px] text-on-surface-variant">earned</p>
                  </div>
                ), align: 'right' },
                { key: 'pending', header: 'Pending', cell: (row) => (
                  <span className="font-body-sm text-amber-600">{row.pending}</span>
                ), align: 'right' },
                { key: 'actions', header: '', cell: () => (
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                ), align: 'right' },
              ]}
              getRowId={(row) => row.id}
            />
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
