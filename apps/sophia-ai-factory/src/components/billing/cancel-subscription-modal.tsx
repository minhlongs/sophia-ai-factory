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
import { CheckCircle2 } from 'lucide-react';
import { cancelSubscriptionAction } from '@/app/actions/billing';
import { TIER_CONFIG } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import { getTierLossKeys } from './cancel-subscription-helpers';
import {
  CancelStep1Content,
  CancelStep2Content,
  type CancelMode,
} from './cancel-subscription-steps';

export type { CancelMode };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: Tier;
  onSuccess?: () => void;
}

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
        {submitState.status === 'success' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                {t('success_title')}
              </DialogTitle>
              <DialogDescription>
                {submitState.mode === 'immediate' ? t('success_immediate') : t('success_eoc')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleClose}>{t('close')}</Button>
            </DialogFooter>
          </>
        ) : step === 1 ? (
          <CancelStep1Content
            tierLabel={tierLabel}
            lossKeys={lossKeys}
            mode={mode}
            onModeChange={setMode}
            onClose={handleClose}
            onNext={() => setStep(2)}
          />
        ) : (
          <CancelStep2Content
            mode={mode}
            errorMessage={submitState.status === 'error' ? submitState.message : undefined}
            isLoading={submitState.status === 'loading'}
            onBack={() => setStep(1)}
            onConfirm={() => void handleConfirm()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
