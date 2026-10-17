'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Filter, Download, CreditCard, Calendar, Clock, RotateCcw } from 'lucide-react';
import { DashboardLayout, Card, StatCard, type StatCardIconColor, Button, Input } from '@/components/stitch';
import { PaymentsTableSection } from './payments-table-section';

export interface PaymentItem {
  id: string;
  date: string;
  customer: string;
  email: string;
  amount: string;
  status: 'paid' | 'pending' | 'refunded' | 'failed';
  /**
   * Strictly compliant with Sophia AI Factory Constitution:
   * Primary: NOWPayments USDT (TRC20/ERC20)
   * Backup Domestic: PayOS (VietQR)
   * PayPal & Stripe customer billing are BANNED.
   */
  method: 'NOWPayments (USDT)' | 'PayOS (VietQR)' | 'NOWPayments' | 'PayOS' | string;
}

export interface PaymentSummaryStat {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface PaymentsPageProps {
  initialPayments?: PaymentItem[];
  initialStats?: PaymentSummaryStat[];
}

export const DEFAULT_ZERO_STATS: PaymentSummaryStat[] = [
  { label: 'Total Revenue', value: '$0.00', change: '0%', trend: 'neutral' },
  { label: 'This Month', value: '$0.00', change: '0%', trend: 'neutral' },
  { label: 'Pending', value: '$0.00', change: '0 items', trend: 'neutral' },
  { label: 'Refunded', value: '$0.00', change: '0%', trend: 'neutral' },
];

export const EMPTY_PAYMENTS: PaymentItem[] = [];

export default function PaymentsPage({
  initialPayments,
  initialStats,
}: PaymentsPageProps = {}) {
  const t = useTranslations('stitch.payments');
  const [search, setSearch] = useState('');

  const localizedDefaultStats: PaymentSummaryStat[] = [
    { label: t('totalRevenue'), value: '$0.00', change: '0%', trend: 'neutral' },
    { label: t('thisMonth'), value: '$0.00', change: '0%', trend: 'neutral' },
    { label: t('pending'), value: '$0.00', change: '0 items', trend: 'neutral' },
    { label: t('refunded'), value: '$0.00', change: '0%', trend: 'neutral' },
  ];

  const paymentsList = initialPayments ?? EMPTY_PAYMENTS;
  const statsList = initialStats ?? localizedDefaultStats;

  const filteredPayments = paymentsList.filter(
    (item) =>
      item.customer.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase()) ||
      item.method.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Button variant="outline" iconLeft={<Download className="w-4 h-4" />}>
          {t('export')}
        </Button>
      }
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsList.map((stat, idx) => {
          const icons = [CreditCard, Calendar, Clock, RotateCcw];
          const colors: StatCardIconColor[] = ['indigo', 'emerald', 'amber', 'rose'];
          const Icon = icons[idx] || CreditCard;
          const color = colors[idx] || 'primary';

          return (
            <StatCard
              key={idx}
              label={stat.label}
              value={stat.value}
              icon={Icon}
              iconColor={color}
              trend={{
                value: stat.change,
                isPositive: stat.trend === 'up',
                isNeutral: stat.trend === 'neutral',
              }}
            />
          );
        })}
      </div>

      {/* Search & Filter */}
      <Card className="mb-xl" padding="md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 w-full"
            />
          </div>
          <Button variant="outline" size="md" iconLeft={<Filter className="w-4 h-4" />} className="w-full sm:w-auto">
            {t('filter')}
          </Button>
        </div>
      </Card>

      {/* Payments Table / Clean Empty State */}
      <PaymentsTableSection payments={filteredPayments} />
    </DashboardLayout>
  );
}
