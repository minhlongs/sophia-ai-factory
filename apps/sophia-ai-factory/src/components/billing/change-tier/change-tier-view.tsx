'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { changeTierAction, type ChangeTierTiming } from '@/app/actions/billing';
import type { Tier } from '@/seed/types';
import TierPlanSelector from '../TierPlanSelector';
import TierConfirmationModal from '../TierConfirmationModal';
import { ChangeTierSuccess } from './change-tier-success';
import { MasterBanner } from './master-banner';
import { ChangeTierActionPanel } from './change-tier-action-panel';
import { isDowngrade, type SubmitState, type ChangeTierClientProps } from './types';

export { ChangeTierActionPanel } from './change-tier-action-panel';

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

      <ChangeTierActionPanel
        selectedTier={selectedTier}
        currentTier={currentTier}
        timing={timing}
        onTimingChange={setTiming}
        submitState={submitState}
        onChangePlan={handleChangePlan}
        t={t}
      />

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
