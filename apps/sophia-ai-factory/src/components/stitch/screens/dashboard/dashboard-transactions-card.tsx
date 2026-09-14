'use client';

import React from 'react';
import { Card, Table, Badge, Button, Avatar } from '@/components/stitch';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { Filter, MoreVertical, ArrowRight, Receipt, CreditCard } from 'lucide-react';

export interface DashboardTransactionItem {
  id: string;
  date: string;
  customer: string;
  amount: string;
  status: string;
}

interface DashboardTransactionsCardProps {
  transactions: DashboardTransactionItem[];
}

export function DashboardTransactionsCard({ transactions }: DashboardTransactionsCardProps) {
  const t = useTranslations('stitch.dashboard');

  return (
    <Card padding="none">
      <div className="p-lg border-b border-outline-variant flex items-center justify-between">
        <div>
          <h4 className="font-headline-sm text-headline-sm text-on-surface">
            {t('recentTransactions.title')}
          </h4>
          <p className="font-label-md text-label-md text-on-surface-variant">
            {t('recentTransactions.subtitle')}
          </p>
        </div>
        <div className="flex gap-sm">
          <Button variant="ghost" size="sm" aria-label="Filter transactions">
            <Filter className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="More options">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="py-2xl px-lg text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-md">
            <Receipt className="w-6 h-6 opacity-60" />
          </div>
          <p className="font-label-lg text-on-surface font-medium mb-xs">
            {t('recentTransactions.emptyTitle')}
          </p>
          <p className="font-body-sm text-on-surface-variant max-w-sm mb-lg">
            {t('recentTransactions.emptyDesc')}
          </p>
          <Link href="/billing">
            <Button size="sm" variant="outline" iconLeft={<CreditCard className="w-4 h-4" />}>
              {t('recentTransactions.topup')}
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table
              data={transactions}
              columns={[
                {
                  key: 'date',
                  header: t('recentTransactions.columns.date'),
                  cell: (row) => (
                    <span className="font-code text-sm text-on-surface-variant">{row.date}</span>
                  ),
                },
                {
                  key: 'customer',
                  header: t('recentTransactions.columns.customer'),
                  cell: (row) => (
                    <div className="flex items-center gap-sm">
                      <Avatar
                        src={null}
                        alt={row.customer}
                        initials={row.customer ? row.customer.charAt(0).toUpperCase() : 'U'}
                        size="sm"
                      />
                      <span className="font-label-md text-on-surface">{row.customer}</span>
                    </div>
                  ),
                },
                {
                  key: 'amount',
                  header: t('recentTransactions.columns.amount'),
                  cell: (row) => (
                    <span className="font-semibold text-on-surface">{row.amount}</span>
                  ),
                  align: 'right' as const,
                },
                {
                  key: 'status',
                  header: t('recentTransactions.columns.status'),
                  cell: (row) => (
                    <Badge
                      variant="soft"
                      color={row.status === 'paid' || row.status === 'completed' ? 'success' : row.status === 'failed' ? 'error' : 'neutral'}
                      size="sm"
                    >
                      {row.status}
                    </Badge>
                  ),
                },
                {
                  key: 'action',
                  header: t('recentTransactions.columns.action'),
                  cell: () => (
                    <Button variant="ghost" size="sm" aria-label="View transaction details">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ),
                  align: 'right' as const,
                },
              ]}
              getRowId={(row) => row.id}
            />
          </div>
          <div className="p-md bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant">
            <p className="text-label-sm text-on-surface-variant">
              {t('recentTransactions.showing', {
                from: 1,
                to: transactions.length,
                total: transactions.length,
              })}
            </p>
            <div className="flex gap-sm">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={transactions.length <= 10}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
