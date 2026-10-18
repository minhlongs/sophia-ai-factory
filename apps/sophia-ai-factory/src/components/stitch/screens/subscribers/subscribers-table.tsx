'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Button, Badge, Table, Avatar } from '@/components/stitch';
import type { SubscriberItem } from './subscribers-page';

// i18n-namespace: stitch.subscribers

export interface SubscribersTableProps {
  subscribers: SubscriberItem[];
  t: (key: string) => string;
}

export function SubscribersTable({ subscribers, t }: SubscribersTableProps) {
  return (
    <Table
      data={subscribers}
      stickyFirstColumn
      emptyMessage={t('emptyMessage')}
      columns={[
        {
          key: 'subscriber',
          header: t('columns.subscriber'),
          cell: (row) => (
            <div className="flex items-center gap-md">
              <Avatar src={row.avatar ?? null} alt={row.name} initials={row.name} size="md" />
              <div>
                <p className="font-label-md text-on-surface">{row.name}</p>
                <p className="text-[12px] text-on-surface-variant">{row.email}</p>
              </div>
            </div>
          ),
        },
        {
          key: 'plan',
          header: t('columns.plan'),
          cell: (row) => (
            <Badge
              variant="soft"
              color={row.plan === 'Enterprise' || row.plan === 'MASTER' ? 'primary' : 'secondary'}
            >
              {row.plan}
            </Badge>
          ),
          align: 'center',
        },
        {
          key: 'status',
          header: t('columns.status'),
          cell: (row) => (
            <Badge variant="soft" color={row.status === 'active' ? 'success' : 'neutral'}>
              {row.status}
            </Badge>
          ),
          align: 'center',
        },
        {
          key: 'joined',
          header: t('columns.joined'),
          cell: (row) => (
            <span className="font-body-sm text-on-surface-variant">{row.joined}</span>
          ),
          align: 'center',
        },
        {
          key: 'actions',
          header: '',
          cell: () => (
            <Button variant="ghost" size="sm" aria-label={t('subscriberActions')}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          ),
          align: 'right',
        },
      ]}
      getRowId={(row) => row.id}
    />
  );
}
