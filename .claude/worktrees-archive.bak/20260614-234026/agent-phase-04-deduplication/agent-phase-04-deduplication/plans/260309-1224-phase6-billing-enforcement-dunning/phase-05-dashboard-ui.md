---
title: "Phase 5: Dashboard UI Components"
description: "Billing status, usage analytics, and dunning state UI components for dashboard"
status: pending
priority: P1
effort: 3h
parent: ../plan.md
---

# Phase 5: Dashboard UI Components

## Overview

Create React components for displaying billing status, usage analytics, dunning state, and overage charges in the user dashboard.

## Components to Create

### Component 1: BillingStatusCard

**File:** `src/components/billing/billing-status-card.tsx` (NEW)

```typescript
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface BillingStatus {
  tier: string;
  status: 'active' | 'past_due' | 'delinquent' | 'suspended';
  nextBillingDate: string;
  amountDue: number;
  currency: string;
}

export function BillingStatusCard() {
  const { data: billingStatus, isLoading } = useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn: async () => {
      const res = await fetch('/api/billing/status');
      if (!res.ok) throw new Error('Failed to fetch billing status');
      return res.json();
    },
  });

  if (isLoading) {
    return <Card><CardHeader><CardTitle>Billing Status</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>;
  }

  const statusConfig = {
    active: {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      label: 'Active',
    },
    past_due: {
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      label: 'Past Due',
    },
    delinquent: {
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      label: 'Delinquent',
    },
    suspended: {
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      label: 'Suspended',
    },
  };

  const config = statusConfig[billingStatus?.status || 'active'];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing Status</CardTitle>
        <CardDescription>Your current subscription status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <p className="font-medium">{config.label}</p>
              <p className="text-sm text-muted-foreground">
                Next billing: {new Date(billingStatus?.nextBillingDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant={billingStatus?.status === 'active' ? 'default' : 'destructive'}>
            {billingStatus?.tier}
          </Badge>
        </div>

        {billingStatus?.status !== 'active' && billingStatus?.amountDue > 0 && (
          <Alert className="mt-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Amount due: ${(billingStatus.amountDue / 100).toFixed(2)}
              <Button size="sm" className="mt-2">
                Pay Now
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

### Component 2: UsageGaugeChart

**File:** `src/components/billing/usage-gauge-chart.tsx` (NEW)

```typescript
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface UsageGaugeChartProps {
  title: string;
  used: number;
  limit: number;
  overage: number;
  unit: string;
}

export function UsageGaugeChart({ title, used, limit, overage, unit }: UsageGaugeChartProps) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isOverLimit = overage > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{used.toLocaleString()} / {limit.toLocaleString()} {unit}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Progress
            value={percentage}
            className={`h-3 ${isOverLimit ? 'bg-red-100' : ''}`}
            indicatorClassName={isOverLimit ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'}
          />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {percentage.toFixed(0)}% used
            </span>
            {isOverLimit && (
              <span className="text-red-600 font-medium">
                +{overage.toLocaleString()} {unit} over limit
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Component 3: OverageChargesTable

**File:** `src/components/billing/overage-charges-table.tsx` (NEW)

```typescript
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';

interface OverageEvent {
  id: string;
  type: string;
  limit: number;
  current: number;
  exceededBy: number;
  pricePerCredit: number;
  totalCharge: number;
  createdAt: string;
  billable: boolean;
}

export function OverageChargesTable() {
  const { data: overages, isLoading } = useQuery<OverageEvent[]>({
    queryKey: ['overage-charges'],
    queryFn: async () => {
      const res = await fetch('/api/billing/overage-events');
      if (!res.ok) throw new Error('Failed to fetch overage events');
      const data = await res.json();
      return data.data;
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const totalCharges = overages?.reduce((sum, o) => sum + o.totalCharge, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Overage Charges</h3>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Unbilled</p>
          <p className="text-2xl font-bold">${totalCharges.toFixed(2)}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Limit</TableHead>
            <TableHead>Used</TableHead>
            <TableHead>Overage</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Charge</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overages?.map((overage) => (
            <TableRow key={overage.id}>
              <TableCell className="font-medium">
                {overage.type.replace('_', ' ').toUpperCase()}
              </TableCell>
              <TableCell>{overage.limit.toLocaleString()}</TableCell>
              <TableCell>{overage.current.toLocaleString()}</TableCell>
              <TableCell className="text-red-600 font-medium">
                +{overage.exceededBy.toLocaleString()}
              </TableCell>
              <TableCell>${overage.pricePerCredit}/credit</TableCell>
              <TableCell className="font-medium">
                ${overage.totalCharge.toFixed(2)}
              </TableCell>
              <TableCell>{new Date(overage.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                {overage.billable ? (
                  <span className="text-green-600">Billed</span>
                ) : (
                  <span className="text-yellow-600">Pending</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {(!overages || overages.length === 0) && (
        <p className="text-center text-muted-foreground py-8">
          No overage charges this billing period
        </p>
      )}
    </div>
  );
}
```

### Component 4: DunningTimeline

**File:** `src/components/billing/dunning-timeline.tsx` (NEW)

```typescript
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Timeline, TimelineItem, TimelineIndicator, TimelineContent } from '@/components/ui/timeline';
import { useQuery } from '@tanstack/react-query';

interface DunningAttempt {
  id: string;
  attemptNumber: number;
  attemptType: string;
  success: boolean;
  amount: number;
  failureReason: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

export function DunningTimeline() {
  const { data: attempts, isLoading } = useQuery<DunningAttempt[]>({
    queryKey: ['dunning-attempts'],
    queryFn: async () => {
      const res = await fetch('/api/billing/dunning-history');
      if (!res.ok) throw new Error('Failed to fetch dunning history');
      const data = await res.json();
      return data.data;
    },
  });

  if (isLoading) {
    return <Card><CardHeader><CardTitle>Payment History</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>Recent payment attempts and retry schedule</CardDescription>
      </CardHeader>
      <CardContent>
        <Timeline>
          {attempts?.map((attempt, index) => (
            <TimelineItem key={attempt.id}>
              <TimelineIndicator
                variant={attempt.success ? 'success' : 'destructive'}
              />
              <TimelineContent>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      Attempt #{attempt.attemptNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {attempt.attemptType.replace('_', ' ')}
                    </p>
                    {!attempt.success && attempt.failureReason && (
                      <p className="text-sm text-red-600 mt-1">
                        {attempt.failureReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      ${(attempt.amount / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(attempt.createdAt).toLocaleDateString()}
                    </p>
                    {attempt.nextRetryAt && (
                      <p className="text-sm text-yellow-600">
                        Next retry: {new Date(attempt.nextRetryAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>

        {(!attempts || attempts.length === 0) && (
          <p className="text-center text-muted-foreground py-8">
            No payment attempts recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Component 5: UsageAnalytics Dashboard Page

**File:** `src/app/[locale]/dashboard/billing/page.tsx` (UPDATE)

```typescript
'use client';

import { BillingStatusCard } from '@/components/billing/billing-status-card';
import { UsageGaugeChart } from '@/components/billing/usage-gauge-chart';
import { OverageChargesTable } from '@/components/billing/overage-charges-table';
import { DunningTimeline } from '@/components/billing/dunning-timeline';
import { useQuery } from '@tanstack/react-query';

export default function BillingDashboardPage() {
  const { data: usageSummary } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      const res = await fetch('/api/usage/summary');
      if (!res.ok) throw new Error('Failed to fetch usage summary');
      return res.json();
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing & Usage</h1>
        <p className="text-muted-foreground">
          Manage your subscription and monitor API usage
        </p>
      </div>

      {/* Billing Status */}
      <BillingStatusCard />

      {/* Usage Gauges */}
      <div className="grid gap-4 md:grid-cols-3">
        <UsageGaugeChart
          title="Hourly Usage"
          used={usageSummary?.summary.hourly.used || 0}
          limit={usageSummary?.summary.hourly.limit || 0}
          overage={usageSummary?.summary.hourly.overage || 0}
          unit="credits"
        />
        <UsageGaugeChart
          title="Daily Usage"
          used={usageSummary?.summary.daily.used || 0}
          limit={usageSummary?.summary.daily.limit || 0}
          overage={usageSummary?.summary.daily.overage || 0}
          unit="credits"
        />
        <UsageGaugeChart
          title="Monthly Usage"
          used={usageSummary?.summary.monthly.used || 0}
          limit={usageSummary?.summary.monthly.limit || 0}
          overage={usageSummary?.summary.monthly.overage || 0}
          unit="credits"
        />
      </div>

      {/* Overage Charges */}
      <OverageChargesTable />

      {/* Dunning Timeline */}
      <DunningTimeline />
    </div>
  );
}
```

## Admin Dashboard Page

**File:** `src/app/[locale]/(admin)/admin/billing/page.tsx` (NEW)

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DollarSign, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function AdminBillingPage() {
  const { data: summary } = useQuery({
    queryKey: ['admin-billing-summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/billing/summary');
      if (!res.ok) throw new Error('Failed to fetch summary');
      return res.json();
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/billing/reconcile', { method: 'POST' });
      if (!res.ok) throw new Error('Reconciliation failed');
      return res.json();
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Billing Management</h1>
          <p className="text-muted-foreground">Admin billing dashboard</p>
        </div>
        <Button
          onClick={() => reconcileMutation.mutate()}
          disabled={reconcileMutation.isPending}
        >
          {reconcileMutation.isPending ? 'Reconciling...' : 'Run Reconciliation'}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.summary.revenue.mrr || 0}
            </div>
            <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.summary.dunning.current || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Past Due</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.summary.dunning.past_due || 0}
            </div>
            <p className="text-xs text-muted-foreground">Grace period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.summary.dunning.suspended || 0}
            </div>
            <p className="text-xs text-muted-foreground">Blocked accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Unbilled Overage */}
      <Card>
        <CardHeader>
          <CardTitle>Unbilled Overage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {summary?.summary.overage.unbilledCredits || 0} credits
          </p>
          <p className="text-muted-foreground">
            Pending billing reconciliation
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Testing

### Component Tests

**File:** `src/components/billing/billing-components.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BillingStatusCard } from './billing-status-card';

const queryClient = new QueryClient();

function renderWithQueryClient(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('Billing Components', () => {
  it('should display active billing status', async () => {
    renderWithQueryClient(<BillingStatusCard />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('should display usage gauge with correct percentage', async () => {
    // Test UsageGaugeChart component
  });
});
```

## Success Criteria

- [ ] `BillingStatusCard` shows current subscription status
- [ ] `UsageGaugeChart` displays usage percentage with color coding
- [ ] `OverageChargesTable` lists unbilled overage events
- [ ] `DunningTimeline` shows payment attempt history
- [ ] Dashboard page integrates all components
- [ ] Admin billing page shows summary stats
- [ ] Component tests pass
- [ ] Responsive design on mobile

## Related Files

- `src/components/billing/billing-status-card.tsx` (NEW)
- `src/components/billing/usage-gauge-chart.tsx` (NEW)
- `src/components/billing/overage-charges-table.tsx` (NEW)
- `src/components/billing/dunning-timeline.tsx` (NEW)
- `src/app/[locale]/dashboard/billing/page.tsx` (UPDATE)
- `src/app/[locale]/(admin)/admin/billing/page.tsx` (NEW)

---

## Unresolved Questions

1. **UI Component Library** - Confirm we're using shadcn/ui components
2. **React Query setup** - Confirm query client is configured in app
3. **Auth for API calls** - How to handle auth in client-side fetch calls?
