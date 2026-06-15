'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent } from '@/seed/components/ui/card';
import { CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react';
import { changeTierAction, type ChangeTierTiming } from '@/app/actions/billing';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import TierPlanSelector from './TierPlanSelector';
import TierConfirmationModal from './TierConfirmationModal';

const SELECTABLE_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE'];

type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; timing: ChangeTierTiming; creditCents?: number; effectiveAt?: string }
  | { status: 'error'; message: string };

export default function ChangeTierClient({ currentTier }: { currentTier: Tier }) {
  const t = useTranslations('dashboard.billing.changeTier');

  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [timing, setTiming] = useState<ChangeTierTiming>('end_of_cycle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  function isDowngrade(tier: Tier) {
    const TIER_RANK: Record<Tier, number> = { BASIC: 1, PREMIUM: 2, ENTERPRISE: 3, MASTER: 4 };
    return TIER_RANK[tier] < TIER_RANK[currentTier];
  }

  function handleSelectTier(tier: Tier) {
    if (tier === currentTier) return;
    setSelectedTier(tier);
    setTiming(isDowngrade(tier) ? 'end_of_cycle' : 'immediate');
  }

  function handleChangePlan() {
    if (!selectedTier) return;
    if (isDowngrade(selectedTier)) {
      setConfirmOpen(true);
    } else {
      void submit(selectedTier, timing);
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t('success_title')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {submitState.timing === 'immediate'
                  ? t('success_immediate')
                  : t('success_end_of_cycle')}
              </p>
              {submitState.creditCents && submitState.creditCents > 0 && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                  {t('success_credit', { amount: `$${(submitState.creditCents / 100).toFixed(2)}` })}
                </p>
              )}
              {submitState.effectiveAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('success_effective_at', {
                    date: new Date(submitState.effectiveAt).toLocaleDateString(),
                  })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Tier grid */}
      <TierPlanSelector
        currentTier={currentTier}
        selectedTier={selectedTier}
        onSelectTier={handleSelectTier}
        submitting={submitState.status === 'loading'}
      />

      {/* MASTER redirect hint */}
      <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-semibold text-sm">{t('master_title')}</p>
            <p className="text-xs text-muted-foreground">{t('master_hint')}</p>
          </div>
          <a href="/pricing" className="shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href="/pricing">
                {t('master_cta')} <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Timing selector (only shown when a tier is selected and it's not a downgrade) */}
      {selectedTier && !isDowngrade(selectedTier) && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="font-medium text-sm">{t('timing_title')}</p>
            <p className="text-xs text-muted-foreground">{t('timing_subtitle')}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setTiming('immediate')}
                className={[
                  'flex-1 text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  timing === 'immediate'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30',
                ].join(' ')}
              >
                <p className="font-medium text-sm">{t('timing_immediate_label')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('timing_immediate_desc')}</p>
              </button>
              <button
                type="button"
                onClick={() => setTiming('end_of_cycle')}
                className={[
                  'flex-1 text-left rounded-lg border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  timing === 'end_of_cycle'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30',
                ].join(' ')}
              >
                <p className="font-medium text-sm">{t('timing_eoc_label')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('timing_eoc_desc')}</p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {submitState.status === 'error' && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <div className="text-sm text-destructive">{submitState.message}</div>
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleChangePlan}
        disabled={!selectedTier || selectedTier === currentTier || submitState.status === 'loading'}
        className="w-full sm:w-auto"
      >
        {submitState.status === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            {t('submitting')}
          </>
        ) : (
          t('submit')
        )}
      </Button>

      {/* Downgrade confirmation modal */}
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
