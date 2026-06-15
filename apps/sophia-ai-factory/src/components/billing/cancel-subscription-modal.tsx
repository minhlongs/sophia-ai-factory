'use client';

import { useState } from 'react';
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
import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cancelSubscriptionAction } from '@/app/actions/billing';
import { TIER_CONFIG } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import CancellationModeSelector from './CancellationModeSelector';
import { LoseItem, getTierLossKeys } from './cancel-subscription-helpers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: Tier;
  onSuccess?: () => void;
}

type CancelMode = 'end_of_cycle' | 'immediate';

type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; mode: CancelMode }
  | { status: 'error'; message: string };

export function CancelSubscriptionModal({ open, onOpenChange, currentTier, onSuccess }: Props) {
  const t = useTranslations('dashboard.billing.cancel');

  const [mode, setMode] = useState<CancelMode>('end_of_cycle');
  const [step, setStep] = useState<1 | 2>(1);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const tierLabel = TIER_CONFIG[currentTier]?.label ?? currentTier;
  const lossKeys = getTierLossKeys(currentTier);

  function handleClose() {
    if (submitState.status === 'loading') return;
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep(1);
      setMode('end_of_cycle');
      setSubmitState({ status: 'idle' });
    }, 200);
  }

  async function handleConfirm() {
    setSubmitState({ status: 'loading' });

    const result = await cancelSubscriptionAction(mode);

    if (result.success) {
      setSubmitState({ status: 'success', mode });
      onSuccess?.();
    } else {
      setSubmitState({ status: 'error', message: t('error_generic') });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* Success state */}
        {submitState.status === 'success' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                {t('success_title')}
              </DialogTitle>
              <DialogDescription>
                {submitState.mode === 'immediate'
                  ? t('success_immediate')
                  : t('success_eoc')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleClose}>{t('close')}</Button>
            </DialogFooter>
          </>
        ) : step === 1 ? (
          /* Step 1: Warn + mode selection */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
                {t('step1_title')}
              </DialogTitle>
              <DialogDescription>{t('step1_desc', { tier: tierLabel })}</DialogDescription>
            </DialogHeader>

            {/* What they'll lose */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
                {t('lose_section_title')}
              </p>
              {lossKeys.map((key) => (
                <LoseItem key={key} text={t(key)} />
              ))}
            </div>

            {/* Mode selection */}
            <CancellationModeSelector
              mode={mode}
              onModeChange={setMode}
            />

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{t('keep_plan')}</Button>
              <Button variant="destructive" onClick={() => setStep(2)}>{t('continue')}</Button>
            </DialogFooter>
          </>
        ) : (
          /* Step 2: Final confirmation */
          <>
            <DialogHeader>
              <DialogTitle>{t('step2_title')}</DialogTitle>
              <DialogDescription>
                {mode === 'immediate' ? t('step2_desc_immediate') : t('step2_desc_eoc')}
              </DialogDescription>
            </DialogHeader>

            {submitState.status === 'error' && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{submitState.message}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitState.status === 'loading'}
              >
                {t('back')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleConfirm()}
                disabled={submitState.status === 'loading'}
              >
                {submitState.status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    {t('submitting')}
                  </>
                ) : (
                  t('confirm_cancel')
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
