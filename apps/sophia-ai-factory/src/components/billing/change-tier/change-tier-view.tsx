'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Loader2, ArrowUpRight } from 'lucide-react';
import { changeTierAction, type ChangeTierTiming } from '@/app/actions/billing';
import type { Tier } from '@/seed/types';
import TierPlanSelector from '../TierPlanSelector';
import TierConfirmationModal from '../TierConfirmationModal';
import { ChangeTierSuccess } from './change-tier-success';
import { DowngradeTimingSelector } from './downgrade-timing-selector';
import { MasterBanner } from './master-banner';
import { isDowngrade, type SubmitState, type ChangeTierClientProps } from './types';

export function ChangeTierView({ currentTier }: ChangeTierClientProps) {
  const t = useTranslations('dashboard.billing.changeTier');

  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [timing, setTiming] = useState<ChangeTierTiming>('end_of_cycle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  function handleSelectTier(tier: Tier) {
    if (tier === currentTier) return;
    setSelectedTier(tier);
    setTiming(isDowngrade(tier, currentTier) ? 'end_of_cycle' : 'immediate');
  }

  function handleChangePlan() {
    if (!selectedTier) return;
    if (isDowngrade(selectedTier, currentTier)) {
      setConfirmOpen(true);
    } else {
      window.location.href = `/api/checkout?tier=${selectedTier.toLowerCase()}`;
    }
  }

  async function submit(tier: Tier, chosenTiming: ChangeTierTiming) {
    setSubmitState({ status: 'loading' });
    setConfirmOpen(false);

    const result = await changeTierAction(tier, chosenTiming);

    if (result.success) {
      setSubmitState({
        status: 'success',
        timing: chosenTiming,
        creditCents: result.creditCents,
        effectiveAt: result.effectiveAt,
      });
    } else if (result.error === 'upgrade_requires_payment') {
      window.location.href = `/api/checkout?tier=${tier.toLowerCase()}`;
    } else if (result.error === 'already_on_tier') {
      setSubmitState({ status: 'error', message: t('error_already_on_tier') });
    } else if (result.error === 'no_active_subscription') {
      setSubmitState({ status: 'error', message: t('error_no_subscription') });
    } else if (result.error === 'master_requires_payment') {
      setSubmitState({ status: 'error', message: t('error_master_payment') });
    } else {
      setSubmitState({ status: 'error', message: t('error_generic') });
    }
  }

  if (submitState.status === 'success') {
    return (
      <ChangeTierSuccess
        timing={submitState.timing}
        creditCents={submitState.creditCents}
        effectiveAt={submitState.effectiveAt}
        t={t}
      />
    );
  }

  return (
    <>
      <TierPlanSelector
        currentTier={currentTier}
        selectedTier={selectedTier}
        onSelectTier={handleSelectTier}
        submitting={submitState.status === 'loading'}
      />

      <MasterBanner t={t} />

      {selectedTier && !isDowngrade(selectedTier, currentTier) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 space-y-1">
            <p className="font-semibold text-sm">
              {t('upgrade')}: {selectedTier}
            </p>
            <p className="text-xs text-muted-foreground">{t('upgrade_notice')}</p>
          </CardContent>
        </Card>
      )}

      {selectedTier && isDowngrade(selectedTier, currentTier) && (
        <DowngradeTimingSelector
          timing={timing}
          onTimingChange={setTiming}
          t={t}
        />
      )}

      {submitState.status === 'error' && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <div className="text-sm text-destructive">{submitState.message}</div>
        </div>
      )}

      <Button
        onClick={handleChangePlan}
        disabled={
          !selectedTier ||
          selectedTier === currentTier ||
          submitState.status === 'loading'
        }
        className="w-full sm:w-auto"
      >
        {submitState.status === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            {t('submitting')}
          </>
        ) : selectedTier && !isDowngrade(selectedTier, currentTier) ? (
          <>
            {t('proceed_checkout')}{' '}
            <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </>
        ) : (
          t('submit')
        )}
      </Button>

      <TierConfirmationModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        selectedTier={selectedTier}
        currentTier={currentTier}
        timing={timing}
        onTimingChange={setTiming}
        onConfirm={async () => {
          if (selectedTier) await submit(selectedTier, timing);
        }}
        submitting={submitState.status === 'loading'}
      />
    </>
  );
}
