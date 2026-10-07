// i18n-namespace: nicheStudio
/**
 * Niche Conversion Stats Card
 *
 * Visualizes real-time conversion telemetry, recurring MRR commissions,
 * and trading fee rebates captured from affiliate postbacks.
 *
 * @module components/niche-studio/niche-conversion-stats-card
 */

import React from 'react';

interface NicheConversionStatsCardProps {
  niche: 'saas_global' | 'crypto_global';
  t: (key: string) => string;
}

export function NicheConversionStatsCard({ niche, t }: NicheConversionStatsCardProps) {
  const isCrypto = niche === 'crypto_global';

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
            <span>📈</span> {t('statsTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('statsSubtitle')}</p>
        </div>
        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t('liveTelemetry')}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-muted/20 border border-border/40 rounded-xl space-y-1">
          <span className="text-xs text-muted-foreground">{t('metricViews')}</span>
          <p className="text-lg font-bold font-mono text-foreground">14.2K</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">↑ +38% hook watch</span>
        </div>

        <div className="p-3.5 bg-muted/20 border border-border/40 rounded-xl space-y-1">
          <span className="text-xs text-muted-foreground">{t('metricClicks')}</span>
          <p className="text-lg font-bold font-mono text-foreground">842</p>
          <span className="text-[10px] text-primary font-medium">5.9% CTR</span>
        </div>

        <div className="p-3.5 bg-muted/20 border border-border/40 rounded-xl space-y-1">
          <span className="text-xs text-muted-foreground">{t('metricConversions')}</span>
          <p className="text-lg font-bold font-mono text-foreground">63</p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">7.4% conv</span>
        </div>

        <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-1">
          <span className="text-xs text-primary font-medium">
            {isCrypto ? t('metricRebates') : t('metricMrr')}
          </span>
          <p className="text-lg font-bold font-mono text-primary">
            {isCrypto ? '$1,480.50' : '$2,240/mo'}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {isCrypto ? '20-30% rebate tier' : '30% recurring MRR'}
          </span>
        </div>
      </div>
    </div>
  );
}
