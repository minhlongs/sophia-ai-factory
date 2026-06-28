---
title: "Phase 02 — Dashboard UI Components"
description: "Xây dựng dashboard UI với usage + revenue tabs, metrics cards, và controls"
status: pending
priority: P2
effort: 2h
---

# Phase 02 — Dashboard UI Components

**Context:**
- Existing: `src/app/[locale]/dashboard/analytics/page.tsx`
- Existing: `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx`
- Existing: `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx`
- Hooks: `src/hooks/use-analytics-data.ts`

---

## Overview

Hoàn thiện dashboard UI với 2 tabs chính (Usage + Revenue), metrics cards, và điều khiển date range, tier filter.

---

## Key Insights

1. **Usage tab đã có** — `UsageAnalyticsView` component với đầy đủ controls
2. **Revenue tab chưa có** — Cần tạo `RevenueAnalyticsView` component
3. **SWR hooks đã có** — `useUsageAnalytics`, `useRevenueAnalytics`, `useLicenseAnalytics`

---

## Requirements

### Functional

1. **Main Analytics Page**
   - Tabs: Usage | Revenue | Licenses
   - User tier hiển thị ở header
   - Last updated timestamp

2. **Usage Tab** (đã có — keep existing)
   - Date range picker (24h, 7d, 30d, 90d + custom cho PREMIUM+)
   - Metrics cards: Requests, Tokens, Credits, Response Time, Error Rate
   - Usage chart (line/area chart với Recharts)
   - Service breakdown (pie chart)
   - License utilization (bar chart)

3. **Revenue Tab** (mới)
   - Period selector (current month, last month, last 7d, last 30d)
   - Metrics cards: MRR, Total Revenue, One-time Revenue, Growth %
   - Revenue by tier (pie chart)
   - Revenue trend (line chart)

4. **Licenses Tab** (mới)
   - Status filter (active, expired, revoked, all)
   - License list với utilization %
   - Tier distribution

### Non-Functional

- Loading states với skeletons
- Error boundaries với fallback UI
- Responsive design (mobile-first)
- i18n với next-intl (vi + en)

---

## Related Code Files

**Modify:**
- `src/app/[locale]/dashboard/analytics/page.tsx` — Add tabs
- `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx` — Refactor

**Create:**
- `src/app/[locale]/dashboard/analytics/components/revenue-analytics-view.tsx`
- `src/app/[locale]/dashboard/analytics/components/license-analytics-view.tsx`
- `src/components/analytics/revenue-metrics-cards.tsx`
- `src/components/analytics/revenue-chart.tsx`
- `src/components/analytics/license-list.tsx`

---

## Implementation Steps

### Step 1: Create Revenue Analytics View

File: `src/app/[locale]/dashboard/analytics/components/revenue-analytics-view.tsx`

```typescript
'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRevenueAnalytics } from '@/hooks/use-analytics-data';
import { RevenueMetricsCards } from '@/components/analytics/revenue-metrics-cards';
import { RevenueByTierChart } from '@/components/analytics/revenue-chart';
import { RevenueTrendChart } from '@/components/analytics/revenue-chart';
import { PeriodSelector } from '@/components/analytics/period-selector';
import type { RevenuePeriod } from '@/lib/analytics/types';

interface RevenueAnalyticsViewProps {
  userTier: string;
  isAdmin: boolean;
}

export function RevenueAnalyticsView({ userTier, isAdmin }: RevenueAnalyticsViewProps) {
  const t = useTranslations('dashboard.analytics');
  const [period, setPeriod] = useState<RevenuePeriod>('current_month');

  const { data, loading, error } = useRevenueAnalytics({ period, isEnabled: true });

  const metricsCardsData = useMemo(() => {
    if (!data) return null;
    return {
      mrr: data.recurringRevenue,
      totalRevenue: data.totalRevenue,
      oneTimeRevenue: data.oneTimeRevenue,
      growth: 0, // Calculate from trend data
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <PeriodSelector value={period} onChange={setPeriod} />

      <RevenueMetricsCards
        metrics={metricsCardsData}
        loading={loading}
        error={error}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <RevenueByTierChart
          data={data?.byTier || []}
          loading={loading}
        />
        <RevenueTrendChart
          data={data?.trend || []}
          loading={loading}
        />
      </div>
    </div>
  );
}
```

### Step 2: Create Revenue Metrics Cards

File: `src/components/analytics/revenue-metrics-cards.tsx`

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, PieChart } from 'lucide-react';

interface RevenueMetricsCardsProps {
  metrics: {
    mrr: number;
    totalRevenue: number;
    oneTimeRevenue: number;
    growth: number;
  } | null;
  loading: boolean;
  error: Error | null;
}

export function RevenueMetricsCards({ metrics, loading, error }: RevenueMetricsCardsProps) {
  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>;
  }

  if (loading || !metrics) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MRR</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.mrr.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.totalRevenue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Including one-time payments</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">One-time Revenue</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${metrics.oneTimeRevenue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">MASTER tier purchases</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 3: Create Revenue Charts

File: `src/components/analytics/revenue-chart.tsx`

```typescript
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export function RevenueByTierChart({ data, loading }: { data: any[], loading: boolean }) {
  if (loading || data.length === 0) {
    return <div className="h-[300px] bg-muted rounded-lg animate-pulse" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="revenue"
          nameKey="tier"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label
        >
          {data.map((entry, index) => (
            <Cell key={entry.tier} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RevenueTrendChart({ data, loading }: { data: any[], loading: boolean }) {
  if (loading || data.length === 0) {
    return <div className="h-[300px] bg-muted rounded-lg animate-pulse" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Step 4: Update Main Analytics Page

File: `src/app/[locale]/dashboard/analytics/page.tsx`

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsageAnalyticsView } from './components/usage-analytics-view';
import { RevenueAnalyticsView } from './components/revenue-analytics-view';
import { LicenseAnalyticsView } from './components/license-analytics-view';

export default function AnalyticsPage({ params }: { params: { locale: string } }) {
  // Get user tier from auth
  const userTier = 'PREMIUM'; // TODO: Get from session
  const isAdmin = false; // TODO: Get from auth

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="licenses">Licenses</TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <UsageAnalyticsView userTier={userTier} userId={userId} />
        </TabsContent>

        <TabsContent value="revenue">
          <RevenueAnalyticsView userTier={userTier} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="licenses">
          <LicenseAnalyticsView userTier={userTier} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 5: i18n Translations

Files: `messages/vi.json`, `messages/en.json`

Add translations for:
- `dashboard.analytics.revenue_tab`
- `dashboard.analytics.mrr`
- `dashboard.analytics.total_revenue`
- `dashboard.analytics.one_time_revenue`
- `dashboard.analytics.revenue_by_tier`
- `dashboard.analytics.revenue_trend`

---

## Todo Checklist

- [ ] Create `revenue-analytics-view.tsx`
- [ ] Create `revenue-metrics-cards.tsx`
- [ ] Create `revenue-chart.tsx` (byTier + trend)
- [ ] Create `license-analytics-view.tsx`
- [ ] Create `license-list.tsx`
- [ ] Update main analytics page với 3 tabs
- [ ] Add i18n translations (vi + en)
- [ ] Test responsive design

---

## Success Criteria

- [ ] 3 tabs hoạt động smooth (Usage, Revenue, Licenses)
- [ ] Metrics cards hiển thị đúng data
- [ ] Charts render properly với Recharts
- [ ] Loading states với skeletons
- [ ] Error boundaries với fallback UI
- [ ] i18n đầy đủ (vi + en)

---

## Security Considerations

1. **Server-side Auth:** User tier phải lấy từ session, không trust client
2. **RBAC:** Revenue tab chỉ hiển thị cho ENTERPRISE+ hoặc admin
3. **Data Isolation:** User không xem được data người khác

---

## Next Steps

→ Phase 03: ROI Calculator logic
→ Phase 04: Enhanced data visualizations
