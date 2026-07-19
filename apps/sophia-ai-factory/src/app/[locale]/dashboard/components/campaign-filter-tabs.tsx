'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/seed/components/ui/tabs';
import { useTranslations } from 'next-intl';
import type { CampaignStatus } from '@/seed/types';

export type CampaignFilter = CampaignStatus | 'all';

interface CampaignFilterTabsProps {
  value: CampaignFilter;
  onChange: (value: CampaignFilter) => void;
}

const FILTER_TABS: { value: CampaignFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'filters.all' },
  { value: 'draft', labelKey: 'filters.draft' },
  { value: 'queued', labelKey: 'filters.queued' },
  { value: 'processing_script', labelKey: 'filters.processing_script' },
  { value: 'processing_video', labelKey: 'filters.processing_video' },
  { value: 'completed', labelKey: 'filters.completed' },
  { value: 'failed', labelKey: 'filters.failed' },
];

export function CampaignFilterTabs({ value, onChange }: CampaignFilterTabsProps) {
  const t = useTranslations('dashboard.campaigns.filters');

  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as CampaignFilter)}>
      <TabsList className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 gap-1">
        {FILTER_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-background transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {t(tab.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

CampaignFilterTabs.displayName = 'CampaignFilterTabs';
