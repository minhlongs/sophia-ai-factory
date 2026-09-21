'use client';

import React, { useState } from 'react';
import { Search, Filter, Download, ArrowUpRight, ArrowDownRight, Eye, CreditCard } from 'lucide-react';
import { DashboardLayout, Card, Button, Badge, Table, Input } from '@/components/stitch';

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
  const [search, setSearch] = useState('');

  const paymentsList = initialPayments ?? EMPTY_PAYMENTS;
  const statsList = initialStats ?? DEFAULT_ZERO_STATS;

  const filteredPayments = paymentsList.filter(
    (item) =>
      item.customer.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase()) ||
      item.method.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout
      title="Payments"
      subtitle="Track transactions, refunds, and revenue"
      actions={
        <Button variant="outline" iconLeft={<Download className="w-4 h-4" />}>
          Export
        </Button>
      }
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-xl">
        {statsList.map((stat, idx) => (
          <Card key={idx} padding="md">
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">
              {stat.label}
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
              placeholder="Search payments by customer, email, or method..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" iconLeft={<Filter className="w-4 h-4" />}>
            Filter
          </Button>
        </div>
      </Card>

      {/* Payments Table / Clean Empty State */}
      <Card padding="none">
        {filteredPayments.length === 0 ? (
          <div className="py-16 text-center px-4">
            <CreditCard className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-4" />
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
              No payment transactions recorded
            </h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md mx-auto mb-6">
              Settlements and confirmations via NOWPayments (USDT) or PayOS (VietQR) will automatically populate here in real-time.
            </p>
          </div>
        ) : (
          <Table
            data={filteredPayments}
            emptyMessage="No payment transactions match your query."
            columns={[
              { key: 'date', header: 'Date', cell: (row) => (
                <span className="font-body-sm text-on-surface-variant">{row.date}</span>
              ) },
              { key: 'customer', header: 'Customer', cell: (row) => (
                <div>
                  <p className="font-label-md text-on-surface">{row.customer}</p>
                  <p className="text-[12px] text-on-surface-variant">{row.email}</p>
                </div>
              ) },
              { key: 'amount', header: 'Amount', cell: (row) => (
                <span className="font-semibold text-on-surface">{row.amount}</span>
              ), align: 'right' },
              { key: 'method', header: 'Method', cell: (row) => (
                <span className="font-body-sm text-on-surface-variant font-mono text-xs">{row.method}</span>
              ), align: 'center' },
              { key: 'status', header: 'Status', cell: (row) => (
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
              { key: 'actions', header: '', cell: () => (
                <Button variant="ghost" size="sm" iconLeft={<Eye className="w-4 h-4" />}>
                  View
                </Button>
              ), align: 'right' },
            ]}
            getRowId={(row) => row.id}
          />
        )}
      </Card>
    </DashboardLayout>
  );
}
