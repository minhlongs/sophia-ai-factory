'use client';

/**
 * Credit Bar Component (Bilingual VI+EN)
 *
 * Shows MCU usage progress for the current billing period.
 * - Green: < 80% usage
 * - Yellow warning: 80-99% usage + "Buy more credits" button
 * - Red alert: 100%+ usage + "Top up now to continue" CTA
 *
 * @module billing/credit-bar
 */

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { AlertTriangle, AlertCircle, Zap } from 'lucide-react';

interface CreditBarProps {
  /** Credits used this billing period */
  usedCredits: number;
  /** Total credit limit */
  totalCredits: number;
  /** Whether overage billing is available */
  overageAvailable?: boolean;
  /** Top-up URL for redirect */
  topUpUrl?: string;
  /** i18n key for the metric label (defaults to 'thisMonth' for MCU) */
  labelKey?: string;
}

export function CreditBar({
  usedCredits,
  totalCredits,
  overageAvailable = false,
  topUpUrl = '/dashboard/billing?tab=topup',
  labelKey = 'thisMonth',
}: CreditBarProps) {
  const t = useTranslations('billing.creditBar');

  const percentage = totalCredits > 0
    ? Math.min(Math.round((usedCredits / totalCredits) * 100), 100)
    : 0;

  const isWarning = percentage >= 80 && percentage < 100;
  const isAtLimit = percentage >= 100;

  const barColor = isAtLimit
    ? 'bg-red-500'
    : isWarning
      ? 'bg-yellow-500'
      : 'bg-green-500';

  const barBgColor = isAtLimit
    ? 'bg-red-100 dark:bg-red-950'
    : isWarning
      ? 'bg-yellow-100 dark:bg-yellow-950'
      : 'bg-green-100 dark:bg-green-950';

  return (
    <Card className={isAtLimit ? 'border-red-300 dark:border-red-700' : isWarning ? 'border-yellow-300 dark:border-yellow-700' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {t('used')}: {usedCredits.toLocaleString()} {t('of')} {totalCredits.toLocaleString()} {t(labelKey)}
          </span>
          <span className={`text-sm font-bold ${isAtLimit ? 'text-red-500' : isWarning ? 'text-yellow-500' : 'text-green-500'}`}>
            {percentage}%
          </span>
        </div>

        {/* Progress bar */}
        <div className={`w-full h-3 rounded-full ${barBgColor} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Status and CTA */}
        <div className="mt-3 flex items-center justify-between">
          {isAtLimit ? (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{t('atLimit')}</span>
            </div>
          ) : isWarning ? (
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{t('nearLimit')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">{percentage}% {t('used')}</span>
            </div>
          )}

          {(isWarning || isAtLimit) && (
            <Button
              variant={isAtLimit ? 'destructive' : isWarning ? 'default' : 'outline'}
              size="sm"
              onClick={() => { window.location.href = topUpUrl; }}
            >
              {isAtLimit ? t('topUpNow') : t('buyMore')}
            </Button>
          )}
        </div>

        {overageAvailable && !isWarning && !isAtLimit && (
          <div className="mt-2 text-xs text-muted-foreground text-right">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => { window.location.href = topUpUrl; }}
            >
              {t('buyMore')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
