'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Button, Badge, Avatar, type ColumnDef } from '@/components/stitch';
import type { MockAffiliate } from './mock-affiliates';

interface ColumnOptions {
  affiliateHeader: string;
  statusHeader: string;
  salesHeader: string;
  commissionHeader: string;
  pendingHeader: string;
  ordersLabel: string;
  earnedLabel: string;
  actionsAriaLabel: string;
}

export function getAffiliatesTableColumns(opts: ColumnOptions): ColumnDef<MockAffiliate>[] {
  return [
    {
      key: 'affiliate',
      header: opts.affiliateHeader,
      cell: (row: MockAffiliate) => (
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
      header: opts.statusHeader,
      cell: (row: MockAffiliate) => (
        <Badge variant="soft" color={row.status === 'active' ? 'success' : 'warning'}>
          {row.status}
        </Badge>
      ),
      align: 'center',
    },
    {
      key: 'sales',
      header: opts.salesHeader,
      cell: (row: MockAffiliate) => (
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{row.totalSales}</p>
          <p className="text-xs text-muted-foreground">{opts.ordersLabel}</p>
        </div>
      ),
      align: 'right',
    },
    {
      key: 'commission',
      header: opts.commissionHeader,
      cell: (row: MockAffiliate) => (
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{row.totalCommission}</p>
          <p className="text-xs text-muted-foreground">{opts.earnedLabel}</p>
        </div>
      ),
      align: 'right',
    },
    {
      key: 'pending',
      header: opts.pendingHeader,
      cell: (row: MockAffiliate) => (
        <span className="text-sm font-semibold text-amber-400">{row.pending}</span>
      ),
      align: 'right',
    },
    {
      key: 'actions',
      header: '',
      cell: () => (
        <Button variant="ghost" size="sm" aria-label={opts.actionsAriaLabel}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      ),
      align: 'right',
    },
  ];
}
