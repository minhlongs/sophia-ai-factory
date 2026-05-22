'use client';

/**
 * ChangeTierClient — self-serve tier change UI.
 *
 * Features:
 *  - Shows all BASIC/PREMIUM/ENTERPRISE tiers (MASTER is one-time purchase, redirects to pricing)
 *  - Prorate-now OR end-of-cycle options
 *  - Downgrade confirmation modal
 *  - Bilingual via next-intl t()
 *
 * @module components/billing/change-tier-client
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import { AlertCircle, CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react';
import { changeTierAction, type ChangeTierTiming } from '@/app/[locale]/dashboard/billing/actions';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tiers available for self-serve change (MASTER requires payment flow) */
const SELECTABLE_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE'];

const TIER_RANK: Record<Tier, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  currentTier: Tier;
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; timing: ChangeTierTiming }
  | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChangeTierClient({ currentTier }: Props) {
  const t = useTranslations('dashboard.billing.changeTier');

  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [timing, setTiming] = useState<ChangeTierTiming>('end_of_cycle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  function isDowngrade(tier: Tier) {
    return TIER_RANK[tier] < TIER_RANK[currentTier];
  }

  function handleSelectTier(tier: Tier) {
    if (tier === currentTier) return;
    setSelectedTier(tier);
    // Default timing: upgrades are immediate, downgrades are end-of-cycle
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
      setSubmitState({ status: 'success', timing: chosenTiming });
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
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Tier grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {SELECTABLE_TIERS.map((tier) => {
          const config = UNIFIED_TIERS[tier];
          const isCurrent = tier === currentTier;
          const isSelected = tier === selectedTier;
          const isDown = isDowngrade(tier);

          return (
            <button
              key={tier}
              type="button"
              onClick={() => handleSelectTier(tier)}
              disabled={isCurrent || submitState.status === 'loading'}
              aria-pressed={isSelected}
              className={[
                'relative text-left rounded-xl border p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isCurrent
                  ? 'border-primary bg-primary/5 cursor-not-allowed'
                  : isSelected
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/5 cursor-pointer'
                    : 'border-border hover:border-primary/50 cursor-pointer',
                submitState.status === 'loading' ? 'opacity-50' : '',
              ].join(' ')}
            >
              {isCurrent && (
                <span className="absolute top-2 right-2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {t('badge_current')}
                </span>
              )}
              <p className="font-semibold text-sm mb-0.5">{config.name}</p>
              <p className="text-lg font-bold">
                ${config.price}
                {config.billingType === 'monthly' && (
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                )}
              </p>
              {isDown && !isCurrent && (
                <span className="mt-2 inline-block text-xs text-amber-600 dark:text-amber-400">
                  {t('badge_downgrade')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MASTER redirect hint */}
      <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-semibold text-sm">{t('master_title')}</p>
            <p className="text-xs text-muted-foreground">{t('master_hint')}</p>
          </div>
          <Link href="/pricing" className="shrink-0">
            <Button variant="outline" size="sm">
              {t('master_cta')} <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Timing selector (only shown when a tier is selected and it's not a downgrade) */}
      {selectedTier && !isDowngrade(selectedTier) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('timing_title')}</CardTitle>
            <CardDescription>{t('timing_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
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
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {submitState.status === 'error' && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-destructive">{submitState.message}</p>
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
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirm_downgrade_title')}</DialogTitle>
            <DialogDescription>
              {t('confirm_downgrade_desc', {
                tier: selectedTier ? UNIFIED_TIERS[selectedTier].name : '',
              })}
            </DialogDescription>
          </DialogHeader>

          {/* What they'll lose */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {t('confirm_lose_title')}
            </p>
            {currentTier === 'ENTERPRISE' && selectedTier !== 'ENTERPRISE' && (
              <>
                <LoseItem text={t('lose_custom_integrations')} />
                <LoseItem text={t('lose_unlimited_channels')} />
                <LoseItem text={t('lose_seo_optimization')} />
              </>
            )}
            {(currentTier === 'ENTERPRISE' || currentTier === 'PREMIUM') &&
              selectedTier === 'BASIC' && (
                <LoseItem text={t('lose_api_access')} />
              )}
          </div>

          {/* Timing within confirm modal for downgrades */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setTiming('end_of_cycle')}
              className={[
                'flex-1 text-left rounded-lg border p-3 transition-all',
                timing === 'end_of_cycle' ? 'border-primary bg-primary/5' : 'border-border',
              ].join(' ')}
            >
              <p className="font-medium text-sm">{t('timing_eoc_label')}</p>
              <p className="text-xs text-muted-foreground">{t('timing_eoc_desc')}</p>
            </button>
            <button
              type="button"
              onClick={() => setTiming('immediate')}
              className={[
                'flex-1 text-left rounded-lg border p-3 transition-all',
                timing === 'immediate' ? 'border-destructive/60 bg-destructive/5' : 'border-border',
              ].join(' ')}
            >
              <p className="font-medium text-sm text-destructive">{t('timing_immediate_label')}</p>
              <p className="text-xs text-muted-foreground">{t('confirm_immediate_downgrade_warning')}</p>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedTier && void submit(selectedTier, timing)}
            >
              {t('confirm_downgrade_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LoseItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
      <span className="text-xs text-amber-700 dark:text-amber-300">{text}</span>
    </div>
  );
}
