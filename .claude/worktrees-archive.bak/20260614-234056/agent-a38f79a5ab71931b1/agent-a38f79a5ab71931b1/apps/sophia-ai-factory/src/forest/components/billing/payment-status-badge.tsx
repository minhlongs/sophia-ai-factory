/**
 * Payment Status Badge Component
 *
 * Displays current payment status with color coding
 */

'use client';

import { Badge } from '@/seed/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/seed/components/ui/tooltip';
import { useLocale } from 'next-intl';

export type PaymentStatusType = 'active' | 'past_due' | 'dunning' | 'cancelled' | 'expired' | 'unknown';

interface PaymentStatusBadgeProps {
  status: PaymentStatusType;
  pastDueAmountCents?: number;
  nextRetryDate?: number;
  dunningAttemptsRemaining?: number;
  currency?: string;
}

export function PaymentStatusBadge({
  status,
  pastDueAmountCents,
  nextRetryDate,
  dunningAttemptsRemaining,
  currency = 'USD',
}: PaymentStatusBadgeProps) {
  const locale = useLocale();
  const getStatusConfig = (status: PaymentStatusType) => {
    const configs: Record<PaymentStatusType, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; description: string }> = {
      active: {
        label: 'Active',
        variant: 'default',
        description: 'Subscription is active and in good standing',
      },
      past_due: {
        label: 'Past Due',
        variant: 'destructive',
        description: pastDueAmountCents
          ? `Payment of ${formatCurrency(pastDueAmountCents, currency, locale)} failed`
          : 'Payment failed',
      },
      dunning: {
        label: 'Payment Failed',
        variant: 'destructive',
        description: nextRetryDate
          ? `Next retry: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(nextRetryDate))}`
          : 'Payment retry scheduled',
      },
      cancelled: {
        label: 'Cancelled',
        variant: 'outline',
        description: 'Subscription has been cancelled',
      },
      expired: {
        label: 'Expired',
        variant: 'secondary',
        description: 'Subscription has expired',
      },
      unknown: {
        label: 'Unknown',
        variant: 'secondary',
        description: 'Unable to determine subscription status',
      },
    };
    return configs[status] || configs.unknown;
  };

  const config = getStatusConfig(status);

  const badgeContent = (
    <Badge
      variant={config.variant}
      className="text-xs font-medium"
    >
      {status === 'dunning' && (
        <span className="mr-1 motion-safe:animate-pulse">⚠️</span>
      )}
      {config.label}
    </Badge>
  );

  // Wrap with tooltip for additional info
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 max-w-[200px]">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {dunningAttemptsRemaining !== undefined && status === 'dunning' && (
              <p className="text-xs text-orange-600">
                {dunningAttemptsRemaining} retry attempts remaining
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatCurrency(cents: number, currency: string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
