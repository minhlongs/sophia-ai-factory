'use client';

import React from 'react';
import { Film } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Button } from '@/seed/components/ui/button';
import {
  type CampaignRow,
  CAMPAIGN_ICON_MAP,
  STATUS_STYLES,
} from './types';

interface RecentActivityProps {
  rows: CampaignRow[];
}

export function RecentActivity({ rows }: RecentActivityProps) {
  const t = useTranslations('stitch.dashboardOverview');

  return (
    <section
      aria-label={t('aria.campaignsTable')}
      className="lg:col-span-2 bg-surface-container border border-outline-variant/10 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">{t('campaigns.title')}</h3>
        <Button variant="link" className="text-primary text-sm font-medium hover:underline p-0 h-auto">
          {t('campaigns.viewAll')}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t('aria.campaignsTable')}</caption>
          <thead>
            <tr className="text-on-surface-variant border-b border-outline-variant/20">
              <th scope="col" className="pb-4 font-semibold pr-4">
                {t('campaigns.columns.name')}
              </th>
              <th scope="col" className="pb-4 font-semibold pr-4">
                {t('campaigns.columns.status')}
              </th>
              <th scope="col" className="pb-4 font-semibold pr-4">
                {t('campaigns.columns.views')}
              </th>
              <th scope="col" className="pb-4 font-semibold pr-4">
                {t('campaigns.columns.revenue')}
              </th>
              <th scope="col" className="pb-4 font-semibold">
                {t('campaigns.columns.lastUpdated')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {rows.map((row) => {
              const Icon = CAMPAIGN_ICON_MAP[row.icon] ?? Film;
              return (
                <tr
                  key={row.id}
                  className="hover:bg-surface-container-high transition-colors"
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                      </div>
                      <span className="font-medium text-white">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                        STATUS_STYLES[row.status]
                      )}
                    >
                      {t(`campaigns.status.${row.status}`)}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-on-surface">{row.views}</td>
                  <td className="py-4 pr-4 text-on-surface">{row.revenue}</td>
                  <td className="py-4 text-on-surface-variant">{row.lastUpdated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
