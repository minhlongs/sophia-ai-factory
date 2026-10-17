'use client';
// i18n-namespace: stitch.campaigns

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Badge } from '@/components/stitch';
import { cn } from '@/seed/utils/cn';
import { STATUS_CONFIG, CHANNEL_ICONS } from './campaigns-page-types';
import type { Campaign } from './campaigns-page-types';

export function CampaignCard({
  campaign,
  t,
}: {
  campaign: Campaign;
  t: (key: string) => string;
}) {
  const statusCfg = STATUS_CONFIG[campaign.status];
  const badgeClass =
    statusCfg.color === 'success'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : statusCfg.color === 'warning'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : 'bg-muted text-muted-foreground';

  return (
    <div
      className={cn(
        'group flex flex-col gap-4 rounded-2xl border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] p-4 transition-all hover:border-primary/40 shadow-sm',
      )}
      role="article"
      aria-label={campaign.title}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground dark:text-white group-hover:text-primary transition-colors truncate">
            {campaign.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="soft" color={statusCfg.color} size="sm" className={badgeClass}>
              {t(statusCfg.labelKey)}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {campaign.channel}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="p-1 text-muted-foreground hover:text-foreground dark:hover:text-white transition-colors flex-shrink-0"
          aria-label={t('aria.moreOptions') + ' ' + campaign.title}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Thumbnail placeholder */}
      <div
        className={cn(
          'relative rounded-lg overflow-hidden h-32 w-full border border-border/50 dark:border-white/[0.06]',
          !campaign.thumbnail && 'bg-muted dark:bg-[#090A10]'
        )}
      >
        {campaign.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic thumbnail URL
          <img
            src={campaign.thumbnail}
            alt=""
            className="w-full h-full object-cover brightness-75 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center opacity-40">
              <span className="text-2xl">🎬</span>
              <span className="text-xs text-muted-foreground">{t('placeholder.thumbnail')}</span>
            </div>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        {/* Channel icons */}
        {campaign.channels.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1" aria-label={t('aria.channelIcons')}>
            {campaign.channels.map((ch) => {
              const Icon = CHANNEL_ICONS[ch];
              return (
                <Icon
                  key={ch}
                  className="text-white text-base"
                  aria-label={ch}
                />
              );
            })}
          </div>
        )}
      </div>

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
            <span className="text-[11px] font-mono font-semibold text-foreground dark:text-white">{campaign.progress}%</span>
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
    </div>
  );
}
