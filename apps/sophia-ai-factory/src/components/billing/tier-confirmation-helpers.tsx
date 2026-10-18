'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import type { Tier } from '@/seed/types';
import type { ChangeTierTiming } from '@/app/actions/billing';

export interface TierConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTier: Tier | null;
  currentTier: Tier;
  timing: ChangeTierTiming;
  onTimingChange: (timing: ChangeTierTiming) => void;
  onConfirm: () => Promise<void>;
  submitting: boolean;
}

export const TIER_LOSS_KEYS: Record<Tier, string[]> = {
  BASIC: ['lose_basic_affiliate', 'lose_basic_videos', 'lose_basic_analytics'],
  PREMIUM: ['lose_premium_api', 'lose_premium_affiliate', 'lose_premium_channels', 'lose_premium_priority'],
  ENTERPRISE: ['lose_enterprise_unlimited', 'lose_enterprise_integrations', 'lose_enterprise_seo', 'lose_enterprise_strategy'],
  MASTER: ['lose_master_lifetime', 'lose_master_vip', 'lose_master_all'],
};

export const BASIC_TIER: Tier = 'BASIC';

export function LoseItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
      <span className="text-xs text-amber-700 dark:text-amber-300">{text}</span>
    </div>
  );
}

export function TierTimingSelector({
  timing,
  onTimingChange,
}: {
  timing: ChangeTierTiming;
  onTimingChange: (timing: ChangeTierTiming) => void;
}) {
  const t = useTranslations('dashboard.billing.changeTier');

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t('mode_title')}</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onTimingChange('end_of_cycle')}
          className={[
            'text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            timing === 'end_of_cycle' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
          ].join(' ')}
        >
          <p className="font-medium text-sm">{t('timing_eoc_label')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('timing_eoc_desc')}</p>
        </button>
        <button
          type="button"
          onClick={() => onTimingChange('immediate')}
          className={[
            'text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
            timing === 'immediate' ? 'border-destructive/60 bg-destructive/5' : 'border-border hover:border-destructive/30',
          ].join(' ')}
        >
          <p className="font-medium text-sm text-destructive">{t('timing_immediate_label')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('confirm_immediate_downgrade_warning')}</p>
        </button>
      </div>
    </div>
  );
}
