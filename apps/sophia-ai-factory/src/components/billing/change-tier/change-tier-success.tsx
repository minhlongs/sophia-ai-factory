'use client';
// i18n-namespace: dashboard.billing.changeTier

import React from 'react';
import { Card, CardContent } from '@/seed/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import type { ChangeTierTiming } from '@/app/actions/billing';

interface ChangeTierSuccessProps {
  timing: ChangeTierTiming;
  creditCents?: number;
  effectiveAt?: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function ChangeTierSuccess({
  timing,
  creditCents,
  effectiveAt,
  t,
}: ChangeTierSuccessProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              {t('success_title')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {timing === 'immediate'
                ? t('success_immediate')
                : t('success_end_of_cycle')}
            </p>
            {creditCents && creditCents > 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                {t('success_credit', {
                  amount: `$${(creditCents / 100).toFixed(2)}`,
                })}
              </p>
            )}
            {effectiveAt && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('success_effective_at', {
                  date: new Date(effectiveAt).toLocaleDateString(),
                })}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
