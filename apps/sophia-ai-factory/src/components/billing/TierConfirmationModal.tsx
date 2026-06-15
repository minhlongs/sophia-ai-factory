'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import { AlertCircle, Loader2 } from 'lucide-react';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier, ChangeTierTiming } from '@/seed/types';

interface TierConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTier: Tier | null;
  currentTier: Tier;
  timing: ChangeTierTiming;
  onTimingChange: (timing: ChangeTierTiming) => void;
  onConfirm: () => Promise<void>;
  submitting: boolean;
}

const TIER_LOSS_KEYS: Record<Tier, string[]> = {
  BASIC: ['lose_basic_affiliate', 'lose_basic_videos', 'lose_basic_analytics'],
  PREMIUM: ['lose_premium_api', 'lose_premium_affiliate', 'lose_premium_channels', 'lose_premium_priority'],
  ENTERPRISE: ['lose_enterprise_unlimited', 'lose_enterprise_integrations', 'lose_enterprise_seo', 'lose_enterprise_strategy'],
  MASTER: ['lose_master_lifetime', 'lose_master_vip', 'lose_master_all'],
};

function LoseItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
      <span className="text-xs text-amber-700 dark:text-amber-300">{text}</span>
    </div>
  );
}

export default function TierConfirmationModal({
  open,
  onOpenChange,
  selectedTier,
  currentTier,
  timing,
  onTimingChange,
  onConfirm,
  submitting,
}: TierConfirmationModalProps) {
  const t = useTranslations('dashboard.billing.changeTier');
  const tierLabel = UNIFIED_TIERS[selectedTier ?? BASIC]?.label ?? selectedTier;
  const lossKeys = selectedTier ? TIER_LOSS_KEYS[selectedTier] ?? TIER_LOSS_KEYS.BASIC : [];

  function handleClose() {
    if (submitting) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedTier && UNIFIED_TIERS[selectedTier]?.price < UNIFIED_TIERS[currentTier]?.price && (
              <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            )}
            {t('confirm_downgrade_title')}
          </DialogTitle>
          <DialogDescription>
            {t('confirm_downgrade_desc', { tier: tierLabel })}
          </DialogDescription>
        </DialogHeader>

        {/* What they'll lose */}
        {selectedTier && UNIFIED_TIERS[selectedTier]?.price < UNIFIED_TIERS[currentTier]?.price && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
              {t('confirm_lose_title')}
            </p>
            {lossKeys.map((key) => (
              <LoseItem key={key} text={t(key as any)} />
            ))}
          </div>
        )}

        {/* Timing selection */}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                {t('submitting')}
              </>
            ) : (
              t('confirm_downgrade_confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
