'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, CreditCard } from 'lucide-react';
import type { UsageSummaryResponse } from './billing-page-types';

interface Props {
  data: UsageSummaryResponse;
  formatCurrency: (cents: number) => string;
}

export function BillingChargeSummary({ data, formatCurrency }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Base Price</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.projectedCharges.basePriceCents)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.license.tier} tier subscription
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overage Charges</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.projectedCharges.overageChargesCents)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.overageEvents.totalCredits.toLocaleString()} credits over limit
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Due</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.projectedCharges.totalCents)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Includes {data.projectedCharges.billableCredits.toLocaleString()} billable credits
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
