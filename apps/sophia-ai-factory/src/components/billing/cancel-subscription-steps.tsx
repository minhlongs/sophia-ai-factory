'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import { AlertCircle, Loader2, XCircle } from 'lucide-react';
import CancellationModeSelector from './CancellationModeSelector';
import { LoseItem } from './cancel-subscription-helpers';

export type CancelMode = 'end_of_cycle' | 'immediate';

export function CancelStep1Content({
  tierLabel,
  lossKeys,
  mode,
  onModeChange,
  onClose,
  onNext,
}: {
  tierLabel: string;
  lossKeys: string[];
  mode: CancelMode;
  onModeChange: (m: CancelMode) => void;
  onClose: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('dashboard.billing.cancel');

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
          {t('step1_title')}
        </DialogTitle>
        <DialogDescription>{t('step1_desc', { tier: tierLabel })}</DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-4 space-y-2">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
          {t('lose_section_title')}
        </p>
        {lossKeys.map((key) => (
          <LoseItem key={key} text={t(key)} />
        ))}
      </div>

      <CancellationModeSelector mode={mode} onModeChange={onModeChange} />

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t('keep_plan')}</Button>
        <Button variant="destructive" onClick={onNext}>{t('continue')}</Button>
      </DialogFooter>
    </>
  );
}

export function CancelStep2Content({
  mode,
  errorMessage,
  isLoading,
  onBack,
  onConfirm,
}: {
  mode: CancelMode;
  errorMessage?: string;
  isLoading: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('dashboard.billing.cancel');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('step2_title')}</DialogTitle>
        <DialogDescription>
          {mode === 'immediate' ? t('step2_desc_immediate') : t('step2_desc_eoc')}
        </DialogDescription>
      </DialogHeader>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          {t('back')}
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? (
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
  );
}
