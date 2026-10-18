'use client';
// i18n-namespace: dashboard.billing.changeTier

import React from 'react';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Loader2, ArrowUpRight } from 'lucide-react';
import type { ChangeTierTiming } from '@/app/actions/billing';
import type { Tier } from '@/seed/types';
import { DowngradeTimingSelector } from './downgrade-timing-selector';
import { isDowngrade, type SubmitState } from './types';

export interface ChangeTierActionPanelProps {
  selectedTier: Tier | null;
  currentTier: Tier;
  timing: ChangeTierTiming;
  onTimingChange: (timing: ChangeTierTiming) => void;
  submitState: SubmitState;
  onChangePlan: () => void;
  t: (key: string) => string;
}

export function ChangeTierActionPanel({
  selectedTier,
  currentTier,
  timing,
  onTimingChange,
  submitState,
  onChangePlan,
  t,
}: ChangeTierActionPanelProps) {
  return (
    <>
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
          onTimingChange={onTimingChange}
          t={t}
        />
      )}

      {submitState.status === 'error' && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <div className="text-sm text-destructive">{submitState.message}</div>
        </div>
      )}

      <Button
        onClick={onChangePlan}
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
    </>
  );
}
