'use client';

import { useTranslations } from 'next-intl';
import type { CancelMode } from './cancel-subscription-modal';

interface CancellationModeSelectorProps {
  mode: CancelMode;
  onModeChange: (mode: CancelMode) => void;
}

export default function CancellationModeSelector({
  mode,
  onModeChange,
}: CancellationModeSelectorProps) {
  const t = useTranslations('dashboard.billing.cancel');

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('mode_title')}</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onModeChange('end_of_cycle')}
          className={[
            'text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            mode === 'end_of_cycle' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
          ].join(' ')}
        >
          <p className="font-medium text-sm">{t('mode_eoc_label')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('mode_eoc_desc')}</p>
        </button>
        <button
          type="button"
          onClick={() => onModeChange('immediate')}
          className={[
            'text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
            mode === 'immediate' ? 'border-destructive/60 bg-destructive/5' : 'border-border hover:border-destructive/30',
          ].join(' ')}
        >
          <p className="font-medium text-sm text-destructive">{t('mode_immediate_label')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('mode_immediate_desc')}</p>
        </button>
      </div>
    </div>
  );
}
