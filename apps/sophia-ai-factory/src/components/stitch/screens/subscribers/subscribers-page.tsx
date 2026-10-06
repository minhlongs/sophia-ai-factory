'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Mail, Phone, MoreVertical, Users, UserCheck, UserX, DollarSign } from 'lucide-react';
import { DashboardLayout, Card, StatCard, Button, Badge, Table, Input, Avatar } from '@/components/stitch';

export interface SubscriberItem {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: 'active' | 'inactive' | 'canceled';
  joined: string;
  avatar?: string | null;
}

export interface SubscribersPageProps {
  initialSubscribers?: SubscriberItem[];
  stats?: {
    total?: number;
    active?: number;
    canceled?: number;
    mrr?: string;
  };
}

export const EMPTY_SUBSCRIBERS: SubscriberItem[] = [];

export default function SubscribersPage({ initialSubscribers, stats }: SubscribersPageProps = {}) {
  const t = useTranslations('stitch.subscribers');
  const [search, setSearch] = useState('');

  const subscribersList = initialSubscribers ?? EMPTY_SUBSCRIBERS;
  const filteredSubscribers = subscribersList.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase()) ||
      item.plan.toLowerCase().includes(search.toLowerCase())
  );

  const totalCount = stats?.total ?? subscribersList.length;
  const activeCount = stats?.active ?? subscribersList.filter((s) => s.status === 'active').length;
  const canceledCount = stats?.canceled ?? subscribersList.filter((s) => s.status === 'canceled').length;
  const mrrDisplay = stats?.mrr ?? '$0';

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Button variant="outline" iconLeft={<MoreVertical className="w-4 h-4" />}>
          {t('export')}
        </Button>
      }
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('total')}
          value={totalCount}
          icon={Users}
          iconColor="indigo"
        />
        <StatCard
          label={t('active')}
          value={activeCount}
          icon={UserCheck}
          iconColor="emerald"
        />
        <StatCard
          label={t('canceled')}
          value={canceledCount}
          icon={UserX}
          iconColor="rose"
        />
        <StatCard
          label={t('mrr')}
          value={mrrDisplay}
          icon={DollarSign}
          iconColor="violet"
        />
      </div>

      {/* Search */}
      <Card className="mb-xl" padding="md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 w-full"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button variant="outline" size="md" iconLeft={<Mail className="w-4 h-4" />} className="w-full sm:w-auto">
              {t('emailAll')}
            </Button>
            <Button variant="outline" size="md" iconLeft={<Phone className="w-4 h-4" />} className="w-full sm:w-auto">
              {t('sms')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Subscribers Table */}
      <Table
        data={filteredSubscribers}
        stickyFirstColumn
        emptyMessage={t('emptyMessage')}
        columns={[
          { key: 'subscriber', header: t('columns.subscriber'), cell: (row) => (
            <div className="flex items-center gap-md">
              <Avatar src={row.avatar ?? null} alt={row.name} initials={row.name} size="md" />
              <div>
                <p className="font-label-md text-on-surface">{row.name}</p>
                <p className="text-[12px] text-on-surface-variant">{row.email}</p>
              </div>
            </div>
          ) },
          { key: 'plan', header: t('columns.plan'), cell: (row) => (
            <Badge variant="soft" color={row.plan === 'Enterprise' || row.plan === 'MASTER' ? 'primary' : 'secondary'}>
              {row.plan}
            </Badge>
          ), align: 'center' },
          { key: 'status', header: t('columns.status'), cell: (row) => (
            <Badge variant="soft" color={row.status === 'active' ? 'success' : 'neutral'}>
              {row.status}
            </Badge>
          ), align: 'center' },
          { key: 'joined', header: t('columns.joined'), cell: (row) => (
            <span className="font-body-sm text-on-surface-variant">{row.joined}</span>
          ), align: 'center' },
          { key: 'actions', header: '', cell: () => (
            <Button variant="ghost" size="sm" aria-label={t('subscriberActions')}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          ), align: 'right' },
        ]}
        getRowId={(row) => row.id}
      />
    </DashboardLayout>
  );
}
