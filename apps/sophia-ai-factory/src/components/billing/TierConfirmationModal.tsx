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
import {
  BASIC_TIER,
  LoseItem,
  TIER_LOSS_KEYS,
  type TierConfirmationModalProps,
  TierTimingSelector,
} from './tier-confirmation-helpers';

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
  const tierLabel = UNIFIED_TIERS[selectedTier ?? BASIC_TIER]?.name ?? selectedTier;
  const lossKeys = selectedTier ? TIER_LOSS_KEYS[selectedTier] ?? TIER_LOSS_KEYS.BASIC : [];
  const isDowngrade = Boolean(
    selectedTier && UNIFIED_TIERS[selectedTier]?.price < UNIFIED_TIERS[currentTier]?.price,
  );

  function handleClose() {
    if (submitting) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDowngrade && (
              <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            )}
            {t('confirm_downgrade_title')}
          </DialogTitle>
          <DialogDescription>
            {t('confirm_downgrade_desc', { tier: tierLabel })}
          </DialogDescription>
        </DialogHeader>

        {isDowngrade && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
              {t('confirm_lose_title')}
            </p>
            {lossKeys.map((key) => (
              <LoseItem key={key} text={t(key)} />
            ))}
          </div>
        )}

        <TierTimingSelector timing={timing} onTimingChange={onTimingChange} />

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
