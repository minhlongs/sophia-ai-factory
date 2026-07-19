---
phase: 03
title: "Dashboard UI Components"
status: pending
effort: 3h
---

# Phase 03: Dashboard UI Components

## Context

**Related Files:**
- Analytics Page: `src/app/[locale]/dashboard/analytics/page.tsx`
- Analytics View: `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx`
- Charts: `src/app/[locale]/dashboard/analytics/components/charts.tsx`
- Dashboard Stats: `src/app/[locale]/dashboard/components/dashboard-stats.tsx`

**Current State:**
- Existing analytics page shows campaign statistics
- Uses Recharts for visualizations
- Tier-based gating for advanced features
- i18n support with next-intl

## Requirements

### Functional
1. Revenue metrics cards (MRR, ARR, Growth Rate)
2. ROI gauge/meter visualization
3. Cohort retention heatmap
4. Revenue breakdown by tier (pie/bar chart)
5. Time series chart for revenue trends

### Non-Functional
1. Responsive design (mobile-first)
2. Loading states with skeletons
3. Error boundaries
4. i18n support (Vietnamese + English)

## Files to Create

1. `src/app/[locale]/dashboard/analytics/components/revenue-metrics.tsx`
2. `src/app/[locale]/dashboard/analytics/components/roi-gauge.tsx`
3. `src/app/[locale]/dashboard/analytics/components/cohort-heatmap.tsx`
4. `src/app/[locale]/dashboard/analytics/components/revenue-chart.tsx`
5. `src/app/[locale]/dashboard/analytics/hooks/use-revenue-data.ts`
6. `src/app/[locale]/dashboard/analytics/hooks/use-roi-data.ts`

## Files to Modify

1. `src/app/[locale]/dashboard/analytics/page.tsx` - Add server-side data fetching
2. `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx` - Integrate new components
3. `messages/vi.json` - Add i18n keys
4. `messages/en.json` - Add i18n keys

## Implementation Steps

### Step 1: Create Revenue Data Hook

```typescript
// src/app/[locale]/dashboard/analytics/hooks/use-revenue-data.ts

import useSWR from 'swr';

interface RevenueMetric {
  periodType: string;
  periodStart: string;
  periodEnd: string;
  grossRevenue: number;
  netRevenue: number;
  totalCreditsUsed: number;
  tier: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};

export function useRevenueData(periodType: 'daily' | 'monthly' = 'monthly') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/analytics/revenue?periodType=${periodType}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    metrics: data?.metrics || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useRevenueSummary() {
  const { data, error, isLoading } = useSWR(
    '/api/analytics/revenue/summary',
    fetcher
  );

  return {
    mrr: data?.summary?.mrr || 0,
    arr: data?.summary?.arr || 0,
    growthRate: data?.summary?.growthRate || 0,
    isLoading,
    isError: error,
  };
}
```

### Step 2: Create Revenue Metrics Cards

```typescript
// src/app/[locale]/dashboard/analytics/components/revenue-metrics.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users } from 'lucide-react';
import { useRevenueSummary } from '../hooks/use-revenue-data';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';

export function RevenueMetrics() {
  const t = useTranslations('dashboard.analytics.revenue');
  const { mrr, arr, growthRate, isLoading } = useRevenueSummary();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            {t('mrr')}
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            ${mrr.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('monthly_recurring')}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            {t('arr')}
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            ${arr.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('annual_recurring')}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            {t('growth_rate')}
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {t('mom_growth')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 3: Create ROI Gauge Component

```typescript
// src/app/[locale]/dashboard/analytics/components/roi-gauge.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useROIData } from '../hooks/use-roi-data';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ROIGaugeProps {
  userTier: string;
}

export function ROIGauge({ userTier }: ROIGaugeProps) {
  const t = useTranslations('dashboard.analytics.roi');
  const { roi, isLoading, isError } = useROIData();

  if (isLoading) {
    return <Skeleton className="h-[200px] rounded-xl" />;
  }

  if (!roi) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[150px] flex items-center justify-center text-muted-foreground">
            {t('no_data')}
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = roi >= 0;
  const roiColor = roi >= 100 ? 'text-green-500' : roi >= 0 ? 'text-yellow-500' : 'text-red-500';

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* ROI Value */}
          <div className={`text-5xl font-bold ${roiColor}`}>
            {isPositive ? <TrendingUp className="inline h-8 w-8" /> : <TrendingDown className="inline h-8 w-8" />}
            {roi.toFixed(1)}%
          </div>

          {/* Interpretation */}
          <p className="text-sm text-muted-foreground text-center">
            {roi >= 100
              ? t('excellent')
              : roi >= 0
              ? t('positive')
              : t('negative')}
          </p>

          {/* Payback Period */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('investment')}</p>
              <p className="text-lg font-semibold">${roi.investment.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('returns')}</p>
              <p className="text-lg font-semibold">${roi.returns.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 4: Create Revenue Time Series Chart

```typescript
// src/app/[locale]/dashboard/analytics/components/revenue-chart.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useRevenueData } from '../hooks/use-revenue-data';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';

interface RevenueChartProps {
  userTier: string;
}

export function RevenueChart({ userTier }: RevenueChartProps) {
  const t = useTranslations('dashboard.analytics.revenue');
  const { metrics, isLoading } = useRevenueData('monthly');

  if (isLoading) {
    return <Skeleton className="h-[400px] rounded-xl" />;
  }

  // Transform data for chart
  const chartData = metrics.map(m => ({
    month: new Date(m.periodStart).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    grossRevenue: Number(m.grossRevenue),
    netRevenue: Number(m.netRevenue),
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{t('revenue_trend')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--foreground)' }} />
              <Line
                type="monotone"
                dataKey="grossRevenue"
                name={t('gross_revenue')}
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="netRevenue"
                name={t('net_revenue')}
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 5: Update Analytics View

```typescript
// src/app/[locale]/dashboard/analytics/components/analytics-view.tsx

// Add imports
import { RevenueMetrics } from './revenue-metrics';
import { ROIGauge } from './roi-gauge';
import { RevenueChart } from './revenue-chart';

// Add to component
export function AnalyticsView({ campaigns, userTier }: AnalyticsViewProps) {
  return (
    <div className="space-y-8">
      {/* Revenue Metrics */}
      <section>
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('revenue_section')}
        </h2>
        <RevenueMetrics />
      </section>

      {/* ROI & Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <ROIGauge userTier={userTier} />
        {/* ... existing charts ... */}
      </div>

      <RevenueChart userTier={userTier} />
    </div>
  );
}
```

### Step 6: Add i18n Keys

```json
// messages/vi.json
{
  "dashboard": {
    "analytics": {
      "revenue": {
        "mrr": "Doanh thu tháng",
        "arr": "Doanh thu năm",
        "growth_rate": "Tỷ lệ tăng trưởng",
        "monthly_recurring": "Doanh thu định kỳ tháng",
        "annual_recurring": "Doanh thu định kỳ năm",
        "mom_growth": "Tăng trưởng so với tháng trước",
        "revenue_trend": "Xu hướng doanh thu",
        "gross_revenue": "Doanh thu gộp",
        "net_revenue": "Doanh thu ròng"
      },
      "roi": {
        "title": "Tỷ suất hoàn vốn (ROI)",
        "no_data": "Chưa có dữ liệu ROI",
        "excellent": "Xuất sắc! Hoàn vốn vượt mong đợi",
        "positive": "Tích cực! Bạn đang có lãi",
        "negative": "Cần cải thiện để đạt hoàn vốn",
        "investment": "Đầu tư",
        "returns": "Doanh thu"
      }
    }
  }
}
```

## Success Criteria

- [ ] Revenue metrics cards display correctly
- [ ] ROI gauge shows accurate calculations
- [ ] Revenue chart renders with smooth animations
- [ ] Loading states work with skeletons
- [ ] i18n translations complete (vi + en)
- [ ] Responsive on mobile/tablet/desktop

## Risks

- **Risk**: Chart performance with large datasets
- **Mitigation**: Use data sampling, limit data points

## Next Steps

After UI components:
1. Integrate with Polar webhooks for real-time revenue (Phase 04)
2. Build ROI calculator (Phase 05)
