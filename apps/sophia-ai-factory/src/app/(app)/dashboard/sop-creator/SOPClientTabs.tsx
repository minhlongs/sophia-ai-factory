'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, DollarSign, Plus } from 'lucide-react';
import { CreatorPayoutsSection } from '@/forest/components/sop/creator-payouts-section';

interface SOPClientTabsProps {
  locale: string;
  userId: string;
}

export function SOPClientTabs({ locale, userId }: SOPClientTabsProps) {
  const t = useTranslations('sop.creator');
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'my-sops';

  const tabs = [
    { id: 'my-sops', label: t('tabs.mySops'), icon: FileText },
    { id: 'earnings', label: t('tabs.earnings'), icon: DollarSign },
    { id: 'payouts', label: t('tabs.payouts'), icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <nav className="border-b border-border" aria-label={t('tabs.pageTitle') || 'Creator Dashboard Tabs'}>
        <ul className="flex gap-1" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <li key={tab.id} role="presentation">
                <a
                  href={`/${locale}/dashboard/sop-creator?tab=${tab.id}`}
                  className={`tab-link flex items-center gap-2 ${isActive ? 'active' : ''}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={tab.id}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {tab.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tab Panels */}
      <div className="tab-panels">
        {/* My SOPs Tab */}
        <div
          id="my-sops"
          className={`tab-panel ${activeTab === 'my-sops' ? 'active' : ''}`}
          role="tabpanel"
          aria-labelledby="my-sops-tab"
        >
          <SOPSList locale={locale} userId={userId} t={t} />
        </div>

        {/* Earnings Tab */}
        <div
          id="earnings"
          className={`tab-panel ${activeTab === 'earnings' ? 'active' : ''}`}
          role="tabpanel"
          aria-labelledby="earnings-tab"
        >
          <EarningsSection locale={locale} userId={userId} t={t} />
        </div>

        {/* Payouts Tab */}
        <div
          id="payouts"
          className={`tab-panel ${activeTab === 'payouts' ? 'active' : ''}`}
          role="tabpanel"
          aria-labelledby="payouts-tab"
        >
          <CreatorPayoutsSection />
        </div>
      </div>

      <style jsx>{`
        .tab-link {
          @apply px-4 py-3 text-sm font-medium text-muted-foreground border-b-2 border-transparent hover:text-foreground hover:border-primary/50 transition-colors flex items-center gap-2;
        }
        .tab-link.active {
          @apply text-primary border-primary;
        }
        .tab-link:hover:not(.active) {
          @apply bg-accent/50;
        }
        .tab-panel {
          @apply hidden;
        }
        .tab-panel.active {
          @apply block;
        }
      `}</style>
    </div>
  );
}

interface SOPSListProps {
  locale: string;
  userId: string;
  t: ReturnType<typeof useTranslations>;
}

function SOPSList({ locale, userId, t }: SOPSListProps) {
  // Placeholder - will be replaced with actual SOPs fetching
  return (
    <div className="bg-card border rounded-lg p-8 text-center">
      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">{t('tabs.noSopsTitle') || 'No SOPs Yet'}</h3>
      <p className="text-muted-foreground mb-6">{t('tabs.noSopsDesc') || 'Create your first SOP listing to start earning'}</p>
      <a href={`/${locale}/dashboard/sop-creator/new`} className="btn btn-primary">
        <Plus className="w-4 h-4 mr-2" /> {t('tabs.createFirstSop') || 'Create First SOP'}
      </a>
    </div>
  );
}

interface EarningsSectionProps {
  locale: string;
  userId: string;
  t: ReturnType<typeof useTranslations>;
}

function EarningsSection({ locale, userId, t }: EarningsSectionProps) {
  // Placeholder - will be replaced with actual earnings data
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <EarningsCard
        title={t('tabs.totalEarned') || 'Total Earned'}
        value="$0"
        desc={t('tabs.allTimeEarnings') || 'All-time earnings'}
        color="emerald"
      />
      <EarningsCard
        title={t('tabs.pending') || 'Pending'}
        value="$0"
        desc={t('tabs.awaitingPayout') || 'Awaiting payout threshold'}
        color="amber"
      />
      <EarningsCard
        title={t('tabs.payable') || 'Payable'}
        value="$0"
        desc={t('tabs.readyForPayout') || 'Ready for next payout'}
        color="blue"
      />
      <EarningsCard
        title={t('tabs.paidOut') || 'Paid Out'}
        value="$0"
        desc={t('tabs.historicalPayouts') || 'Historical payouts'}
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