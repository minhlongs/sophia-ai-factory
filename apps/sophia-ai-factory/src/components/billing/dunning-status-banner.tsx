/**
 * Dunning Status Banner Component
 *
 * Displays warning banner when account is in past_due, delinquent, or suspended state.
 * Shows escalation messages based on dunning state.
 */

'use client';

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

const DUNNING_CONFIG: Record<DunningState, {
  title: string;
  description: string;
  icon: React.ReactNode;
  variant: 'destructive' | 'warning' | 'info' | 'success';
  showAction: boolean;
  actionLabel: string;
}> = {
  current: {
    title: 'Account in Good Standing',
    description: 'Your subscription is active and up to date.',
    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
    variant: 'success',
    showAction: false,
    actionLabel: '',
  },
  past_due: {
    title: 'Payment Past Due',
    description: 'A recent payment failed. Your service will be suspended if not resolved.',
    icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
    variant: 'warning',
    showAction: true,
    actionLabel: 'Pay Now',
  },
  delinquent: {
    title: 'Account Delinquent',
    description: 'Multiple payment failures detected. Service suspension is imminent.',
    icon: <Clock className="h-5 w-5 text-orange-600" />,
    variant: 'destructive',
    showAction: true,
    actionLabel: 'Restore Service',
  },
  suspended: {
    title: 'Service Suspended',
    description: 'Your API access has been suspended due to non-payment.',
    icon: <XCircle className="h-5 w-5 text-red-600" />,
    variant: 'destructive',
    showAction: true,
    actionLabel: 'Restore Service',
  },
};

export function DunningStatusBanner({
  state,
  gracePeriodEndsAt,
  failedPaymentCount,
  blockReason,
  allowed,
}: DunningStatusBannerProps) {
  const config = DUNNING_CONFIG[state];

  // Don't show banner if account is current
  if (state === 'current' || !allowed) {
    return null;
  }

  return (
    <Alert variant={config.variant === 'destructive' ? 'destructive' : 'default'} className="mb-6">
      {config.icon}
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <p>{config.description}</p>

          {gracePeriodEndsAt && state === 'past_due' && (
            <p className="text-sm text-muted-foreground">
              Grace period ends:{' '}
              <strong>{new Date(gracePeriodEndsAt).toLocaleDateString()}</strong>
            </p>
          )}

          {failedPaymentCount !== undefined && failedPaymentCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {failedPaymentCount} failed payment{failedPaymentCount > 1 ? 's' : ''}
              </Badge>
            </div>
          )}

          {blockReason && (
            <p className="text-sm text-muted-foreground">
              Reason: {blockReason}
            </p>
          )}

          {config.showAction && (
            <div className="mt-4">
              <Button asChild>
                <Link href="/dashboard/billing/payment">
                  {config.actionLabel}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
