'use client';

import React from 'react';
import {
  DollarSign,
  Users,
  TrendingUp,
  Handshake,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Filter,
  ArrowRight,
} from 'lucide-react';
import {
  DashboardLayout,
  Card,
  CardHeader,
  CardContent,
  Table,
  Badge,
  Button,
  Avatar,
} from '@/components/stitch';

// Mock data - replace with real API calls
const mockMetrics = [
  {
    id: 'revenue',
    label: 'Total Revenue',
    value: '$124,500',
    change: '+4.5%',
    trend: 'up',
    icon: DollarSign,
  },
  {
    id: 'subscribers',
    label: 'Active Subscribers',
    value: '1,240',
    change: '+12%',
    trend: 'up',
    icon: Users,
  },
  {
    id: 'growth',
    label: 'Monthly Growth',
    value: '12.5%',
    change: '+12.5%',
    trend: 'up',
    icon: TrendingUp,
  },
  {
    id: 'commission',
    label: 'Commission Paid',
    value: '$8,200',
    change: 'Weekly',
    trend: 'neutral',
    icon: Handshake,
  },
] as const;

const mockAffiliates = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    initials: 'SJ',
    stats: '24 Sales • $1,200',
    commission: '+$450',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWSzEsLXtlCtQl1JnTEm3U6SpevfsPDoGf5AETFg_kJqGKabfczl1Ki8Pei4SD7ANALXRbw-6UgDLHRQvpjVYic1Ruql8gfEgqHV7KL9DYJpKbBvxdLiieBRVrxqcIhnJRHVIMkDmD7VqEWT951o6ciCz9VwMV9svjRL5bfsJq42_CjIASiXbLP-NtOSNxovB_IMnangbB04G2r8QWfnKrM-6qMJpncKFAA5EbcHl4bRR9dELLiRWTMJuqz4dlxMu-_nhvZw7tcEY',
  },
  {
    id: '2',
    name: 'Mark Thompson',
    initials: 'MT',
    stats: '18 Sales • $940',
    commission: '+$310',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByHOqTZvd0_lBYpj2NSkQXfZCPUKV_eVwbIm_zXv5ByFdriQ1zFvvy66kMfI1FAklZ92tIsB7HIUjOxpzzodhJwxg7XMicrxxbW9PNtpZfU6gpWqp6CQCtne5yQhhXSTyH6wCbDHSFg3yoYgp6W-PzaPyZ3BlEdoj0MMChl8VV9qv43sWBvbLce63EkggGqMSDL2PT6ahn5io6Hc2NGHUKqj0vHm2qQTH0aPyR67SS11WLiJ8pIzNfJIU3F1fKXZvmVSaO_hx6Fg',
  },
  {
    id: '3',
    name: 'Lydia Wells',
    initials: 'LW',
    stats: '12 Sales • $600',
    commission: '+$220',
    avatar: null,
  },
  {
    id: '4',
    name: 'James Chen',
    initials: 'JC',
    stats: '8 Sales • $410',
    commission: '+$105',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGZr4YpKoijz4WYuZNO0522FfJKdFQWYUoIi-kLbPXfLiEjARMh_4cwWq1gNaK24lKlRB08a84jMpMruzQm4JWikamNkEnVs3yw7WgsXn6TFttfQeRtrYVUVB09h5vwWu60oqZOI3ca4MwX4WR0_41LMDab7-Ds8kGqUJdZXOOdJ455C1Fk-EA56UeZa5y2JDD7nLna7spVR-cvGTfy8zdmeRg1jvioNQRjX0sP93-ObJLQxdGTaH9O02Y_kcsLwMdykdp9hRR0eg',
  },
];

const mockTransactions = [
  {
    id: '1',
    date: 'Oct 24, 2023',
    customer: { name: 'John Doe', initials: 'JD' },
    amount: '$99.00',
    status: 'paid',
  },
  {
    id: '2',
    date: 'Oct 24, 2023',
    customer: { name: 'Maria Smith', initials: 'MS' },
    amount: '$149.00',
    status: 'paid',
  },
  {
    id: '3',
    date: 'Oct 23, 2023',
    customer: { name: 'Robert King', initials: 'RK' },
    amount: '$99.00',
    status: 'pending',
  },
  {
    id: '4',
    date: 'Oct 23, 2023',
    customer: { name: 'Linda Blair', initials: 'LB' },
    amount: '$49.00',
    status: 'paid',
  },
];

const chartData = [40, 60, 45, 85, 70, 95, 65];

export default function DashboardPage() {
  return (
    <DashboardLayout
      title="Dashboard Overview"
      subtitle="Welcome back. Here's what's happening with your workspace today."
      actions={
        <>
          <Button variant="outline" iconLeft={<MoreVertical className="w-4 h-4" />}>
            Export Data
          </Button>
          <Button iconLeft={<MoreVertical className="w-4 h-4" />}>
            Add Product
          </Button>
        </>
      }
    >
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
        {mockMetrics.map((metric) => (
          <Card key={metric.id} hoverable>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-sm bg-surface-container rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <metric.icon className="w-5 h-5" />
                </div>
                {metric.trend === 'up' && (
                  <Badge variant="soft" color="success" size="sm">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    {metric.change}
                  </Badge>
                )}
                {metric.trend === 'neutral' && (
                  <Badge variant="soft" color="neutral" size="sm">
                    {metric.change}
                  </Badge>
                )}
              </div>
              <p className="text-on-surface-variant font-label-md mt-md mb-xs">
                {metric.label}
              </p>
              <h3 className="text-on-surface font-headline-md">{metric.value}</h3>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Chart & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xl">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface">
                  Revenue Over Time
                </h4>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  Total sales performance this quarter
                </p>
              </div>
              <select className="bg-surface-container-low border-none rounded-xl text-label-sm font-label-sm focus:ring-primary-container pr-8">
                <option>Last 30 Days</option>
                <option>Last 6 Months</option>
                <option>Year to Date</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-base pt-md">
              {chartData.map((height, idx) => (
                <div
                  key={idx}
                  className="w-full bg-primary/10 rounded-t-lg relative group flex-1"
                  style={{ height: '100%' }}
                >
                  <div
                    className="absolute inset-0 bg-primary rounded-t-lg transition-all duration-500 group-hover:bg-primary-container"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-md px-base text-on-surface-variant font-label-sm">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Affiliates */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                Top Affiliates
              </h4>
              <Button variant="ghost" size="sm" className="text-primary">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-md">
              {mockAffiliates.map((affiliate) => (
                <div key={affiliate.id} className="flex items-center gap-md">
                  <Avatar
                    src={affiliate.avatar}
                    alt={affiliate.name}
                    initials={affiliate.initials}
                    size="md"
                  />
                  <div className="flex-1">
                    <p className="font-label-md text-on-surface">{affiliate.name}</p>
                    <p className="text-[12px] text-on-surface-variant">{affiliate.stats}</p>
                  </div>
                  <div className="text-emerald-600 font-label-md">{affiliate.commission}</div>
                </div>
              ))}
            </div>
            <div className="mt-lg pt-lg border-t border-outline-variant">
              <Button variant="outline" fullWidth>
                Invite New Affiliate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card padding="none">
        <div className="p-lg border-b border-outline-variant flex items-center justify-between">
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface">
              Recent Transactions
            </h4>
            <p className="font-label-md text-label-md text-on-surface-variant">
              Latest subscriber payments and refunds
            </p>
          </div>
          <div className="flex gap-sm">
            <Button variant="ghost" size="sm">
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Table
          data={mockTransactions}
          columns={[
            { key: 'date', header: 'Date', cell: (row) => (
              <span className="font-code text-sm text-on-surface-variant">{row.date}</span>
            ) },
            { key: 'customer', header: 'Customer', cell: (row) => (
              <div className="flex items-center gap-sm">
                <Avatar
                  src={null}
                  alt={row.customer.name}
                  initials={row.customer.initials}
                  size="sm"
                />
                <span className="font-label-md text-on-surface">{row.customer.name}</span>
              </div>
            ) },
            { key: 'amount', header: 'Amount', cell: (row) => (
              <span className="font-semibold text-on-surface">{row.amount}</span>
            ), align: 'right' as const },
            { key: 'status', header: 'Status', cell: (row) => (
              <Badge
                variant="soft"
                color={row.status === 'paid' ? 'success' : 'neutral'}
                size="sm"
              >
                {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
              </Badge>
            )},
            { key: 'action', header: '', cell: () => (
              <Button variant="ghost" size="sm">
                <ArrowRight className="w-4 h-4" />
              </Button>
            ), align: 'right' as const },
          ]}
          getRowId={(row) => row.id}
        />
        <div className="p-md bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant">
          <p className="text-label-sm text-on-surface-variant">
            Showing 1-4 of 1,240 transactions
          </p>
          <div className="flex gap-sm">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
}
