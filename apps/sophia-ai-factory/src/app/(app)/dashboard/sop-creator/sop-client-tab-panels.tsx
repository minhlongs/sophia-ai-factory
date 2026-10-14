// i18n-namespace: sop.creator
'use client';

import { FileText, Plus } from 'lucide-react';
import type { useTranslations } from 'next-intl';

export interface SOPSListProps {
  locale: string;
  userId: string;
  t: ReturnType<typeof useTranslations>;
}

export function SOPSList({ locale, userId: _userId, t }: SOPSListProps) {
  return (
    <div className="bg-card border rounded-lg p-8 text-center">
      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">{t('tabs.noSopsTitle')}</h3>
      <p className="text-muted-foreground mb-6">{t('tabs.noSopsDesc')}</p>
      <a href={`/${locale}/dashboard/sop-creator/new`} className="btn btn-primary">
        <Plus className="w-4 h-4 mr-2" /> {t('tabs.createFirstSop')}
      </a>
    </div>
  );
}

export interface EarningsSectionProps {
  locale: string;
  userId: string;
  t: ReturnType<typeof useTranslations>;
}

export function EarningsSection({ locale: _locale, userId: _userId, t }: EarningsSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <EarningsCard
        title={t('tabs.totalEarned')}
        value="$0"
        desc={t('tabs.allTimeEarnings')}
        color="emerald"
      />
      <EarningsCard
        title={t('tabs.pending')}
        value="$0"
        desc={t('tabs.awaitingPayout')}
        color="amber"
      />
      <EarningsCard
        title={t('tabs.payable')}
        value="$0"
        desc={t('tabs.readyForPayout')}
        color="blue"
      />
      <EarningsCard
        title={t('tabs.paidOut')}
        value="$0"
        desc={t('tabs.historicalPayouts')}
        color="violet"
      />
    </div>
  );
}

interface EarningsCardProps {
  title: string;
  value: string;
  desc: string;
  color: string;
}

function EarningsCard({ title, value, desc, color }: EarningsCardProps) {
  const colorClasses: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  };

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className={`px-2 py-0.5 rounded text-xs font-medium border ${colorClasses[color]}`}>
          {title}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
