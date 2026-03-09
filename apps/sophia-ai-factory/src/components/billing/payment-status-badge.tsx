/**
 * Payment Status Badge Component
 *
 * Displays current payment status with color coding
 */

'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
          ? `Payment of ${formatCurrency(pastDueAmountCents, currency)} failed`
          : 'Payment failed',
      },
      dunning: {
        label: 'Payment Failed',
        variant: 'destructive',
        description: nextRetryDate
          ? `Next retry: ${new Date(nextRetryDate).toLocaleDateString()}`
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
        <span className="mr-1 animate-pulse">⚠️</span>
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

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
