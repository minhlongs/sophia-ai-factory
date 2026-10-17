'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Eye, CreditCard } from 'lucide-react';
import { Card, Button, Badge, Table } from '@/components/stitch';
import type { PaymentItem } from './payments-page';

interface PaymentsTableSectionProps {
  payments: PaymentItem[];
}

export function PaymentsTableSection({ payments }: PaymentsTableSectionProps) {
  const t = useTranslations('stitch.payments');

  if (payments.length === 0) {
    return (
      <Card padding="lg">
        <div className="py-16 text-center px-4">
          <CreditCard className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-4" />
          <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
            {t('emptyTitle')}
          </h4>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md mx-auto mb-6">
            {t('emptyDesc')}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Table
      data={payments}
      stickyFirstColumn
      emptyMessage={t('emptyFilterMessage')}
      columns={[
        {
          key: 'date',
          header: t('columns.date'),
          cell: (row) => (
            <span className="font-body-sm text-on-surface-variant">{row.date}</span>
          ),
        },
        {
          key: 'customer',
          header: t('columns.customer'),
          cell: (row) => (
            <div>
              <p className="font-label-md text-on-surface">{row.customer}</p>
              <p className="text-[12px] text-on-surface-variant">{row.email}</p>
            </div>
          ),
        },
        {
          key: 'amount',
          header: t('columns.amount'),
          cell: (row) => (
            <span className="font-semibold text-on-surface">{row.amount}</span>
          ),
          align: 'right',
        },
        {
          key: 'method',
          header: t('columns.method'),
          cell: (row) => (
            <span className="font-body-sm text-on-surface-variant font-mono text-xs">
              {row.method}
            </span>
          ),
          align: 'center',
        },
        {
          key: 'status',
          header: t('columns.status'),
          cell: (row) => (
            <Badge
              variant="soft"
              color={
                row.status === 'paid'
                  ? 'success'
                  : row.status === 'pending'
                    ? 'warning'
                    : row.status === 'refunded'
                      ? 'neutral'
                      : 'error'
              }
            >
              {row.status}
            </Badge>
          ),
          align: 'center',
        },
        {
          key: 'actions',
          header: '',
          cell: () => (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Eye className="w-4 h-4" />}
              aria-label={t('view')}
            >
              {t('view')}
            </Button>
          ),
          align: 'right',
        },
      ]}
      getRowId={(row) => row.id}
    />
  );
}
