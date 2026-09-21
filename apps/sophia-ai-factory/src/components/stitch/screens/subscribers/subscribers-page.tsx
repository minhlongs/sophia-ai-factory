'use client';

import React, { useState } from 'react';
import { Search, Mail, Phone, MoreVertical } from 'lucide-react';
import { DashboardLayout, Card, Button, Badge, Table, Input, Avatar } from '@/components/stitch';

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
      title="Subscribers"
      subtitle="Manage your subscribers and their subscriptions"
      actions={
        <Button variant="outline" iconLeft={<MoreVertical className="w-4 h-4" />}>
          Export
        </Button>
      }
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-xl">
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Total</p>
          <p className="font-headline-md text-headline-md text-on-surface">{totalCount}</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Active</p>
          <p className="font-headline-md text-headline-md text-emerald-600">{activeCount}</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Canceled</p>
          <p className="font-headline-md text-headline-md text-on-surface-variant">{canceledCount}</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">MRR</p>
          <p className="font-headline-md text-headline-md text-primary">{mrrDisplay}</p>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-xl" padding="md">
        <div className="flex items-center gap-md">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <Input
              placeholder="Search subscribers by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-sm">
            <Button variant="outline" size="md">
              <Mail className="w-4 h-4 mr-sm" />
              Email All
            </Button>
            <Button variant="outline" size="md">
              <Phone className="w-4 h-4 mr-sm" />
              SMS
            </Button>
          </div>
        </div>
      </Card>

      {/* Subscribers Table */}
      <Card padding="none">
        <Table
          data={filteredSubscribers}
          emptyMessage="No subscribers registered yet. Customer subscriptions activated through NOWPayments or PayOS will appear here."
          columns={[
            { key: 'subscriber', header: 'Subscriber', cell: (row) => (
              <div className="flex items-center gap-md">
                <Avatar src={row.avatar ?? null} alt={row.name} initials={row.name} size="md" />
                <div>
                  <p className="font-label-md text-on-surface">{row.name}</p>
                  <p className="text-[12px] text-on-surface-variant">{row.email}</p>
                </div>
              </div>
            ) },
            { key: 'plan', header: 'Plan', cell: (row) => (
              <Badge variant="soft" color={row.plan === 'Enterprise' || row.plan === 'MASTER' ? 'primary' : 'secondary'}>
                {row.plan}
              </Badge>
            ), align: 'center' },
            { key: 'status', header: 'Status', cell: (row) => (
              <Badge variant="soft" color={row.status === 'active' ? 'success' : 'neutral'}>
                {row.status}
              </Badge>
            ), align: 'center' },
            { key: 'joined', header: 'Joined', cell: (row) => (
              <span className="font-body-sm text-on-surface-variant">{row.joined}</span>
            ), align: 'center' },
            { key: 'actions', header: '', cell: () => (
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            ), align: 'right' },
          ]}
          getRowId={(row) => row.id}
        />
      </Card>
    </DashboardLayout>
  );
}
