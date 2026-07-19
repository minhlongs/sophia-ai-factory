/**
 * Tier Change Dialog
 *
 * Modal for changing subscription tier. Shows tier selector, prorated pricing,
 * confirmation step with feature loss warnings for downgrades.
 * Server Action via changeTier() from @/land/billing/actions/change-tier-action.
 * Bilingual VI+EN via useTranslations.
 *
 * @module app/[locale]/dashboard/billing/tier-change-dialog
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2, ArrowDown, ArrowUp } from 'lucide-react';
import { TIER_CONFIG } from '@/seed/config/tiers';
import { changeTier } from '@/land/billing/actions/change-tier-action';
import type { Tier } from '@/seed/types';

interface TierChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: Tier;
  onSuccess?: () => void;
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'selecting_tier' }
  | { status: 'loading' }
  | { status: 'success'; newTier: Tier; proratedAmount: number }
  | { status: 'error'; message: string };

const TIER_ORDER: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
const TIER_RANK: Record<string, number> = { BASIC: 1, PREMIUM: 2, ENTERPRISE: 3, MASTER: 4 };

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function TierChangeDialog({ open, onOpenChange, currentTier, onSuccess }: TierChangeDialogProps) {
  const t = useTranslations('dashboard.billing.changeTier');

  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  // Reset state when dialog opens
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && submitState.status !== 'loading') {
      onOpenChange(false);
      setTimeout(() => {
        setSelectedTier(null);
        setSubmitState({ status: 'idle' });
      }, 200);
    } else {
      onOpenChange(newOpen);
    }
  }

  async function handleConfirm() {
    if (!selectedTier) return;
    setSubmitState({ status: 'loading' });

    try {
      const result = await changeTier(selectedTier);
      if (result.ok) {
        setSubmitState({
          status: 'success',
          newTier: result.value.newTier,
          proratedAmount: result.value.proratedAmount,
        });
        onSuccess?.();
      } else {
        setSubmitState({ status: 'error', message: result.error.message });
      }
    } catch (err) {
      setSubmitState({ status: 'error', message: err instanceof Error ? err.message : 'An unexpected error occurred' });
    }
  }

  const availableTiers = TIER_ORDER.filter((tier) => tier !== 'MASTER');
  const currentRank = TIER_RANK[currentTier] ?? 0;

  // Success screen
  if (submitState.status === 'success') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              {t('successTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm">
              {t(submitState.proratedAmount > 0 ? 'successImmediate' : 'successEndOfCycle', {
                tier: submitState.newTier,
                amount: formatCurrency(submitState.proratedAmount),
              })}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>{t('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Error screen
  if (submitState.status === 'error') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('errorTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-destructive py-2">{submitState.message}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitState({ status: 'selecting_tier' })}>
              {t('retry')}
            </Button>
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Tier selection screen
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {availableTiers.map((tier) => {
            const tierRank = TIER_RANK[tier] ?? 0;
            const config = TIER_CONFIG[tier];
            const isCurrent = tier === currentTier;
            const isUpgrade = tierRank > currentRank;
            const isDowngrade = tierRank < currentRank && tierRank > 0;
            const isSelected = selectedTier === tier;

            return (
              <button
                key={tier}
                type="button"
                disabled={isCurrent || submitState.status === 'loading'}
                onClick={() => setSelectedTier(tier)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : isCurrent
                      ? 'border-muted bg-muted/30 cursor-not-allowed'
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{config?.label ?? tier}</span>
                    {isCurrent && <Badge variant="secondary">{t('badgeCurrent')}</Badge>}
                    {isUpgrade && (
                      <Badge variant="default" className="gap-1">
                        <ArrowUp className="h-3 w-3" />
                        {t('upgrade')}
                      </Badge>
                    )}
                    {isDowngrade && (
                      <Badge variant="outline" className="gap-1">
                        <ArrowDown className="h-3 w-3" />
                        {t('downgrade')}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">{config?.features.length ?? 0} {t('features')}</span>
                </div>
                {config && (
                  <ul className="mt-2 space-y-1">
                    {config.features.slice(0, 3).map((f) => (
                      <li key={f} className="text-xs text-muted-foreground">- {f}</li>
                    ))}
                    {config.features.length > 3 && (
                      <li className="text-xs text-muted-foreground">+{config.features.length - 3} more</li>
                    )}
                  </ul>
                )}
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitState.status === 'loading'}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTier || selectedTier === currentTier || submitState.status === 'loading'}
          >
            {submitState.status === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
