'use client';

import React from 'react';
import { Campaign, CampaignFilter } from '@/seed/types';
import { useTranslations } from 'next-intl';
import { CampaignFilterTabs } from '@/forest/dashboard/campaign/campaign-filter-tabs';
import { CampaignGrid } from '@/forest/dashboard/campaign/campaign-grid';
import { CampaignDetailModal } from '../components/campaign-detail-modal';
import { Button } from '@/seed/components/ui/button';
import Link from 'next/link';
import { Plus, Megaphone } from 'lucide-react';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { cn } from '@/seed/utils/cn';

interface CampaignsClientWrapperProps {
  initialCampaigns: Campaign[];
}

export function CampaignsClientWrapper({ initialCampaigns }: CampaignsClientWrapperProps) {
  const [filter, setFilter] = React.useState<CampaignFilter>('all');
  const [selectedCampaign, setSelectedCampaign] = React.useState<Campaign | null>(null);
  const t = useTranslations('dashboard.campaigns');
  const tEmpty = useTranslations('dashboard.emptyState.campaigns');

  const filteredCampaigns = React.useMemo(() => {
    if (filter === 'all') return initialCampaigns;
    return initialCampaigns.filter(c => c.status === filter);
  }, [initialCampaigns, filter]);

  if (initialCampaigns.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild className="flex items-center gap-2">
              <Link href="/dashboard/create">
                <Plus className="w-4 h-4" aria-hidden="true" />
                {t('buttons.new_campaign')}
              </Link>
            </Button>
          </div>
        </div>
        <EmptyState
          icon={Megaphone}
          title={tEmpty('title')}
          description={tEmpty('description')}
          cta={{ label: tEmpty('cta'), href: '/dashboard/create' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild className="flex items-center gap-2">
            <Link href="/dashboard/create">
              <Plus className="w-4 h-4" aria-hidden="true" />
              {t('buttons.new_campaign')}
            </Link>
          </Button>
        </div>
      </div>

      <CampaignFilterTabs value={filter} onChange={setFilter} />

      <p className="text-sm text-muted-foreground">
        {t('showing_count', { count: filteredCampaigns.length, total: initialCampaigns.length })}
      </p>

      <CampaignGrid
        campaigns={filteredCampaigns}
        onCampaignSelect={setSelectedCampaign}
      />

      <CampaignDetailModal
        campaign={selectedCampaign}
        isOpen={selectedCampaign !== null}
        onClose={() => setSelectedCampaign(null)}
      />
    </div>
  );
}

CampaignsClientWrapper.displayName = 'CampaignsClientWrapper';
