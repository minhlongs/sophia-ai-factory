'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Filter, Download, ArrowUpRight, ArrowDownRight, Eye } from 'lucide-react';
import { DashboardLayout, Card, CardHeader, CardContent, Button, Badge, Table, Input } from '@/components/stitch';

const mockPayments = [
  {
    id: '1',
    date: 'Oct 24, 2023',
    customer: 'John Doe',
    email: 'john@acme.com',
    amount: '$99.00',
    status: 'paid',
    method: 'Visa •••• 4242',
  },
  {
    id: '2',
    date: 'Oct 24, 2023',
    customer: 'Maria Smith',
    email: 'maria@techco.io',
    amount: '$149.00',
    status: 'paid',
    method: 'Mastercard •••• 5555',
  },
  {
    id: '3',
    date: 'Oct 23, 2023',
    customer: 'Robert King',
    email: 'robert@startup.io',
    amount: '$99.00',
    status: 'pending',
    method: 'PayPal',
  },
  {
    id: '4',
    date: 'Oct 23, 2023',
    customer: 'Linda Blair',
    email: 'linda@corp.net',
    amount: '$49.00',
    status: 'refunded',
    method: 'Visa •••• 1234',
  },
  {
    id: '5',
    date: 'Oct 22, 2023',
    customer: 'James Chen',
    email: 'james@dev.io',
    amount: '$199.00',
    status: 'paid',
    method: 'Stripe',
  },
  {
    id: '6',
    date: 'Oct 21, 2023',
    customer: 'Patricia Wong',
    email: 'pat@design.co',
    amount: '$79.00',
    status: 'failed',
    method: 'Amex •••• 3456',
  },
];

const summaryStats = [
  { label: 'Total Revenue', value: '$124,500', change: '+4.5%', trend: 'up' },
  { label: 'This Month', value: '$18,250', change: '+12.3%', trend: 'up' },
  { label: 'Pending', value: '$3,420', change: '2 items', trend: 'neutral' },
  { label: 'Refunded', value: '$1,240', change: '-2.1%', trend: 'down' },
];

export default function PaymentsPage() {
  const t = useTranslations('stitch.payments');
  const [search, setSearch] = useState('');

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Button variant="outline" iconLeft={<Download className="w-4 h-4" />}>
          {t('download')}
        </Button>
      }
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-xl">
        {[
          { key: 'totalRevenue', value: '$124,500', change: '+4.5%', trend: 'up' },
          { key: 'thisMonth', value: '$18,250', change: '+12.3%', trend: 'up' },
          { key: 'pending', value: '$3,420', change: '2 items', trend: 'neutral' },
          { key: 'refunded', value: '$1,240', change: '-2.1%', trend: 'down' },
        ].map((stat, idx) => (
          <Card key={idx} padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">
              {t(`summary.${stat.key}`)}
            </p>
            <div className="flex items-baseline gap-sm">
              <p className="font-headline-md text-headline-md text-on-surface">{stat.value}</p>
              {stat.trend === 'up' && (
                <Badge variant="soft" color="success" size="sm">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  {stat.change}
                </Badge>
              )}
              {stat.trend === 'down' && (
                <Badge variant="soft" color="error" size="sm">
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  {stat.change}
                </Badge>
              )}
              {stat.trend === 'neutral' && (
                <span className="text-[12px] text-on-surface-variant">{stat.change}</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <Card className="mb-xl" padding="md">
        <div className="flex items-center gap-md">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" iconLeft={<Filter className="w-4 h-4" />}>
            {t('filter')}
          </Button>
        </div>
      </Card>

      {/* Payments Table */}
      <Card padding="none">
        <Table
          data={mockPayments}
          columns={[
            { key: 'date', header: t('columns.date'), cell: (row) => (
              <span className="font-body-sm text-on-surface-variant">{row.date}</span>
            ) },
            { key: 'customer', header: t('columns.customer'), cell: (row) => (
              <div>
                <p className="font-label-md text-on-surface">{row.customer}</p>
                <p className="text-[12px] text-on-surface-variant">{row.email}</p>
              </div>
            ) },
            { key: 'amount', header: t('columns.amount'), cell: (row) => (
              <span className="font-semibold text-on-surface">{row.amount}</span>
            ), align: 'right' },
            { key: 'method', header: t('columns.method'), cell: (row) => (
              <span className="font-body-sm text-on-surface-variant">{row.method}</span>
            ), align: 'center' },
            { key: 'status', header: t('columns.status'), cell: (row) => (
              <Badge
                variant="soft"
                color={
                  row.status === 'paid' ? 'success' :
                  row.status === 'pending' ? 'warning' :
                  row.status === 'refunded' ? 'neutral' : 'error'
                }
              >
                {row.status}
              </Badge>
            ), align: 'center' },
            { key: 'actions', header: t('columns.actions'), cell: () => (
              <Button variant="ghost" size="sm" iconLeft={<Eye className="w-4 h-4" />}>
                {t('actions.view')}
              </Button>
            ), align: 'right' },
          ]}
          getRowId={(row) => row.id}
        />
      </Card>
    </DashboardLayout>
  );
}
