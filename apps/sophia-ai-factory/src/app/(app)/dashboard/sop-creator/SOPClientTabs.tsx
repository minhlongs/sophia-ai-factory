'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, DollarSign } from 'lucide-react';
import { CreatorPayoutsSection } from '@/forest/components/sop/creator-payouts-section';
import { SOPSList, EarningsSection } from './sop-client-tab-panels';

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

      <div className="tab-panels">
        <div
          id="my-sops"
          className={`tab-panel ${activeTab === 'my-sops' ? 'active' : ''}`}
          role="tabpanel"
          aria-labelledby="my-sops-tab"
        >
          <SOPSList locale={locale} userId={userId} t={t} />
        </div>

        <div
          id="earnings"
          className={`tab-panel ${activeTab === 'earnings' ? 'active' : ''}`}
          role="tabpanel"
          aria-labelledby="earnings-tab"
        >
          <EarningsSection locale={locale} userId={userId} t={t} />
        </div>

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
