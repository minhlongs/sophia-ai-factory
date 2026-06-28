/**
 * Dunning Status Banner Component
 *
 * Displays warning banner when account is in past_due, delinquent, or suspended state.
 * Shows escalation messages based on dunning state.
 */

'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/seed/components/ui/alert';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { AlertTriangle, XCircle, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended';

interface DunningStatusBannerProps {
  state: DunningState;
  gracePeriodEndsAt?: string | null;
  failedPaymentCount?: number;
  blockReason?: string;
  allowed: boolean;
}

const DUNNING_VARIANT: Record<DunningState, 'destructive' | 'warning' | 'info' | 'success'> = {
  current: 'success',
  past_due: 'warning',
  delinquent: 'destructive',
  suspended: 'destructive',
};

const DUNNING_ICON: Record<DunningState, React.ReactNode> = {
  current: <CheckCircle className="h-5 w-5 text-green-600" />,
  past_due: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
  delinquent: <Clock className="h-5 w-5 text-orange-600" />,
  suspended: <XCircle className="h-5 w-5 text-red-600" />,
};

const DUNNING_SHOW_ACTION: Record<DunningState, boolean> = {
  current: false, past_due: true, delinquent: true, suspended: true,
};

export function DunningStatusBanner({
  state,
  gracePeriodEndsAt,
  failedPaymentCount,
  blockReason,
  allowed,
}: DunningStatusBannerProps) {
  const t = useTranslations('dashboard.billing.dunning');
  const locale = useLocale();
  const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  if (state === 'current' || !allowed) {
    return null;
  }

  const variant = DUNNING_VARIANT[state];
  const icon = DUNNING_ICON[state];
  const showAction = DUNNING_SHOW_ACTION[state];

  return (
    <Alert variant={variant === 'destructive' ? 'destructive' : 'default'} className="mb-6">
      {icon}
      <AlertTitle>{t(`${state}.title`)}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <p>{t(`${state}.description`)}</p>

          {gracePeriodEndsAt && state === 'past_due' && (
            <p className="text-sm text-muted-foreground">
              {t('graceEnds', { date: new Date(gracePeriodEndsAt).toLocaleDateString(dateLocale) })}
            </p>
          )}

          {failedPaymentCount !== undefined && failedPaymentCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {t('failedPayments', { count: failedPaymentCount })}
              </Badge>
            </div>
          )}

          {blockReason && (
            <p className="text-sm text-muted-foreground">
              {t('reasonLabel')} {blockReason}
            </p>
          )}

          {showAction && (
            <div className="mt-4">
              <Button asChild>
                <Link href="/dashboard/billing/payment">{t(`${state}.action`)}</Link>
              </Button>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
