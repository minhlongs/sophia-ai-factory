'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp, Users, DollarSign, Clock } from 'lucide-react';
import { StatCard } from '@/components/stitch';

interface StatHeaderProps {
  totalCount: number;
  activeCount: number;
  totalCommission: string;
  pendingCommission: string;
}

export function StatHeader({
  totalCount,
  activeCount,
  totalCommission,
  pendingCommission,
}: StatHeaderProps) {
  const t = useTranslations('stitch.affiliates');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label={t('totalAffiliates')}
        value={totalCount}
        icon={TrendingUp}
        iconColor="indigo"
      />
      <StatCard
        label={t('active')}
        value={activeCount}
        icon={Users}
        iconColor="emerald"
      />
      <StatCard
        label={t('totalCommission')}
        value={totalCommission}
        icon={DollarSign}
        iconColor="violet"
      />
      <StatCard
        label={t('pending')}
        value={pendingCommission}
        icon={Clock}
        iconColor="amber"
      />
    </div>
  );
}
