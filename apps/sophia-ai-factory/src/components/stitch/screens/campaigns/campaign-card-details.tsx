'use client';
// i18n-namespace: stitch.campaigns

import React from 'react';
import type { Campaign } from './campaigns-page-types';

export function CampaignCardDetails({
  campaign,
  t,
}: {
  campaign: Campaign;
  t: (key: string) => string;
}) {
  return (
    <>
      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        {([
          ['views', t('metrics.views')],
          ['revenue', t('metrics.revenue')],
          ['ctr', t('metrics.ctr')],
        ] as const).map(([key, label]) => (
          <div key={key} className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {label}
            </p>
            <p className="text-sm font-bold font-mono text-foreground dark:text-white mt-0.5 tabular-nums">
              {campaign.metrics[key]}
            </p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {campaign.progress > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] text-muted-foreground">{campaign.progressLabel}</span>
            <span className="text-[11px] font-mono font-semibold text-foreground dark:text-white">
              {campaign.progress}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted dark:bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${campaign.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[11px] font-mono text-muted-foreground">
          {t('lastPublished') + ' ' + campaign.lastPublished}
        </span>
        <button
          type="button"
          className="text-primary text-[11px] font-bold hover:underline transition-colors"
        >
          {t('actions.' + campaign.actionLabel)}
        </button>
      </div>
    </>
  );
}
