'use client';
// i18n-namespace: dashboard.billing.changeTier

import React from 'react';
import { Card, CardContent } from '@/seed/components/ui/card';
import type { ChangeTierTiming } from '@/app/actions/billing';

interface DowngradeTimingSelectorProps {
  timing: ChangeTierTiming;
  onTimingChange: (val: ChangeTierTiming) => void;
  t: (key: string) => string;
}

export function DowngradeTimingSelector({
  timing,
  onTimingChange,
  t,
}: DowngradeTimingSelectorProps) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <p className="font-medium text-sm">{t('timing_title')}</p>
        <p className="text-xs text-muted-foreground">{t('timing_subtitle')}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => onTimingChange('end_of_cycle')}
            className={[
              'flex-1 text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              timing === 'end_of_cycle'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30',
            ].join(' ')}
          >
            <p className="font-medium text-sm">{t('timing_eoc_label')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('timing_eoc_desc')}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onTimingChange('immediate')}
            className={[
              'flex-1 text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              timing === 'immediate'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30',
            ].join(' ')}
          >
            <p className="font-medium text-sm">{t('timing_immediate_label')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('timing_immediate_desc')}
            </p>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
