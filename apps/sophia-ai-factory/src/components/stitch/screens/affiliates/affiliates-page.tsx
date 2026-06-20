'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Mail, Plus, MoreVertical, TrendingUp, DollarSign } from 'lucide-react';
import { DashboardLayout, Card, CardHeader, CardContent, Button, Badge, Table, Input, Avatar } from '@/components/stitch';

const mockAffiliates = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    email: 'sarah@partner.io',
    status: 'active',
    totalSales: 24,
    totalCommission: '$1,200',
    pending: '$450',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWSzEsLXtlCtQl1JnTEm3U6SpevfsPDoGf5AETFg_kJqGKabfczl1Ki8Pei4SD7ANALXRbw-6UgDLHRQvpjVYic1Ruql8gfEgqHV7KL9DYJpKbBvxdLiieBRVrxqcIhnJRHVIMkDmD7VqEWT951o6ciCz9VwMV9svjRL5bfsJq42_CjIASiXbLP-NtOSNxovB_IMnangbB04G2r8QWfnKrM-6qMJpncKFAA5EbcHl4bRR9dELLiRWTMJuqz4dlxMu-_nhvZw7tcEY',
  },
  {
    id: '2',
    name: 'Mark Thompson',
    email: 'mark@affiliate.net',
    status: 'active',
    totalSales: 18,
    totalCommission: '$940',
    pending: '$310',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuByHOqTZvd0_lBYpj2NSkQXfZCPUKV_eVwbIm_zXv5ByFdriQ1zFvvy66kMfI1FAklZ92tIsB7HIUjOxpzzodhJwxg7XMicrxxbW9PNtpZfU6gpWqp6CQCtne5yQhhXSTyH6wCbDHSFg3yoYgp6W-PzaPyZ3BlEdoj0MMChl8VV9qv43sWBvbLce63EkggGqMSDL2PT6ahn5io6Hc2NGHUKqj0vHm2qQTH0aPyR67SS11WLiJ8pIzNfJIU3F1fKXZvmVSaO_hx6Fg',
  },
  {
    id: '3',
    name: 'Lydia Wells',
    email: 'lydia@promo.co',
    status: 'pending',
    totalSales: 12,
    totalCommission: '$600',
    pending: '$220',
    avatar: null,
  },
  {
    id: '4',
    name: 'James Chen',
    email: 'james@referral.dev',
    status: 'active',
    totalSales: 8,
    totalCommission: '$410',
    pending: '$105',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGZr4YpKoijz4WYuZNO0522FfJKdFQWYUoIi-kLbPXfLiEjARMh_4cwWq1gNaK24lKlRB08a84jMpMruzQm4JWikamNkEnVs3yw7WgsXn6TFttfQeRtrYVUVB09h5vwWu60oqZOI3ca4MwX4WR0_41LMDab7-Ds8kGqUJdZXOOdJ455C1Fk-EA56UeZa5y2JDD7nLna7spVR-cvGTfy8zdmeRg1jvioNQRjX0sP93-ObJLQxdGTaH9O02Y_kcsLwMdykdp9hRR0eg',
  },
];

export default function AffiliatesPage() {
  const t = useTranslations('stitch.affiliates');
  const [search, setSearch] = useState('');

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <Button iconLeft={<Plus className="w-4 h-4" />}>
          {t('newAffiliate')}
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md mb-xl">
        <Card padding="md">
          <div className="flex items-center gap-md">
            <div className="p-sm bg-secondary-container rounded-xl text-secondary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant">{t('totalAffiliates')}</p>
              <p className="font-headline-md text-headline-md text-on-surface">24</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('active')}</p>
          <p className="font-headline-md text-headline-md text-emerald-600">18</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('totalCommission')}</p>
          <p className="font-headline-md text-headline-md text-on-surface">$8,200</p>
        </Card>
        <Card padding="md">
          <p className="font-label-md text-label-md text-on-surface-variant mb-xs">{t('pending')}</p>
          <p className="font-headline-md text-headline-md text-amber-600">$1,980</p>
        </Card>
      </div>

      {/* Search */}
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
          <Button variant="outline" iconLeft={<Mail className="w-4 h-4" />}>
            {t('emailAll')}
          </Button>
        </div>
      </Card>

      {/* Affiliates List */}
      <Card padding="none">
        <Table
          data={mockAffiliates}
          columns={[
            { key: 'affiliate', header: t('columns.affiliate'), cell: (row) => (
              <div className="flex items-center gap-md">
                <Avatar src={row.avatar} alt={row.name} initials={row.name} size="md" />
                <div>
                  <p className="font-label-md text-on-surface">{row.name}</p>
                  <p className="text-[12px] text-on-surface-variant">{row.email}</p>
                </div>
              </div>
            ) },
            { key: 'status', header: t('columns.status'), cell: (row) => (
              <Badge variant="soft" color={row.status === 'active' ? 'success' : 'warning'}>
                {row.status}
              </Badge>
            ), align: 'center' },
            { key: 'sales', header: t('columns.sales'), cell: (row) => (
              <div className="text-right">
                <p className="font-label-md text-on-surface">{row.totalSales}</p>
                <p className="text-[12px] text-on-surface-variant">orders</p>
              </div>
            ), align: 'right' },
            { key: 'commission', header: t('columns.commission'), cell: (row) => (
              <div className="text-right">
                <p className="font-label-md text-on-surface">{row.totalCommission}</p>
                <p className="text-[12px] text-on-surface-variant">earned</p>
              </div>
            ), align: 'right' },
            { key: 'pending', header: t('pending'), cell: (row) => (
              <span className="font-body-sm text-amber-600">{row.pending}</span>
            ), align: 'right' },
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
