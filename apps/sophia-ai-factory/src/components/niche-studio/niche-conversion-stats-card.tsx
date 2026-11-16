// i18n-namespace: nicheStudio
/**
 * Niche Conversion Stats Card
 *
 * Illustrative benchmark figures for the selected niche. No live attribution
 * feed is wired to this card in this pass, so every number is labelled as an
 * example rather than presented as measured telemetry.
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
        <span
          data-testid="niche-stats-state"
          className="px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold text-xs rounded-full"
        >
          {t('demoBadge')}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-muted/20 border border-border/40 rounded-xl space-y-1">
          <span className="text-xs text-muted-foreground">{t('metricViews')}</span>
          <p className="text-lg font-bold font-mono text-muted-foreground">14.2K</p>
        </div>

        <div className="p-3.5 bg-muted/20 border border-border/40 rounded-xl space-y-1">
          <span className="text-xs text-muted-foreground">{t('metricClicks')}</span>
          <p className="text-lg font-bold font-mono text-muted-foreground">842</p>
        </div>

        <div className="p-3.5 bg-muted/20 border border-border/40 rounded-xl space-y-1">
          <span className="text-xs text-muted-foreground">{t('metricConversions')}</span>
          <p className="text-lg font-bold font-mono text-muted-foreground">63</p>
        </div>

        <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-1">
          <span className="text-xs text-primary font-medium">
            {isCrypto ? t('metricRebates') : t('metricMrr')}
          </span>
          <p className="text-lg font-bold font-mono text-primary">
            {isCrypto ? '$1,480.50' : '$2,240/mo'}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{t('demoNote')}</p>
    </div>
  );
}
