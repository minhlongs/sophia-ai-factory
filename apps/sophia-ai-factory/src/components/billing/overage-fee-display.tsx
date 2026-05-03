/**
 * Overage Fee Display Component
 *
 * Shows current period overage charges with breakdown by type
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/seed/components/ui/card';

import { formatCurrency } from '@/seed/utils/currency';

interface OverageFee {
  type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  credits: number;
  chargeCents: number;
}

interface OverageFeeDisplayProps {
  overageFees?: OverageFee[];
  totalOverageCents: number;
  projectedInvoiceCents: number;
  currency?: string;
  periodStart?: number;
  periodEnd?: number;
}

export function OverageFeeDisplay({
  overageFees = [],
  totalOverageCents,
  projectedInvoiceCents,
  currency = 'USD',
  periodStart,
  periodEnd,
}: OverageFeeDisplayProps) {
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hourly_credits: 'Hourly Overage',
      daily_credits: 'Daily Overage',
      monthly_credits: 'Monthly Overage',
      daily_requests: 'Request Overage',
    };
    return labels[type] || type;
  };

  const periodLabel = periodStart && periodEnd
    ? `${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`
    : 'Current Period';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overage Fees</CardTitle>
        <CardDescription>{periodLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {overageFees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-lg">No overage fees this period</p>
            <p className="text-sm">You&apos;re within your quota limits</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {overageFees.map((fee, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{getTypeLabel(fee.type)}</p>
                    <p className="text-sm text-muted-foreground">
                      {fee.credits.toLocaleString()} credits over limit
                    </p>
                  </div>
                  <p className="font-semibold text-red-600">
                    +{formatCurrency(fee.chargeCents, currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total Overage:</span>
                <span className="text-lg font-semibold text-red-600">
                  {formatCurrency(totalOverageCents, currency)}
                </span>
              </div>

              <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">Projected Next Invoice</p>
                  <p className="text-sm text-muted-foreground">
                    Base + Overage charges
                  </p>
                </div>
                <span className="text-xl font-bold">
                  {formatCurrency(projectedInvoiceCents, currency)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
