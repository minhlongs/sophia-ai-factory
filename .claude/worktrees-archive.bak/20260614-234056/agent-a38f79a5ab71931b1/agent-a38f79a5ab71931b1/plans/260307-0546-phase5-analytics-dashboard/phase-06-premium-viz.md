---
phase: 06
title: "Premium Visualizations"
status: pending
effort: 1h
---

# Phase 06: Premium Visualizations

## Context

**Related Files:**
- Charts Component: `src/app/[locale]/dashboard/analytics/components/charts.tsx`
- Analytics View: `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx`
- RaaS License Gating: `src/lib/raas-gate.ts`

**Current State:**
- Basic charts exist for campaign analytics
- Premium features gated by tier in UI
- Missing: Advanced visualizations for revenue/ROI data

## Requirements

### Functional
1. Revenue by tier (stacked bar chart)
2. Cohort retention heatmap
3. ROI distribution across users
4. Revenue funnel visualization
5. Export charts as PNG/PDF

### Non-Functional
1. License-gated access (PREMIUM+)
2. Responsive chart sizing
3. Dark/light theme support
4. Export functionality

## Files to Create

1. `src/app/[locale]/dashboard/analytics/components/revenue-by-tier-chart.tsx`
2. `src/app/[locale]/dashboard/analytics/components/cohort-heatmap.tsx`
3. `src/app/[locale]/dashboard/analytics/components/revenue-funnel.tsx`
4. `src/lib/analytics/chart-export-service.ts`

## Files to Modify

1. `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx` - Add premium chart sections
2. `src/lib/analytics/analytics-types.ts` - Add chart data types

## Implementation Steps

### Step 1: Create Revenue by Tier Chart

```typescript
// src/app/[locale]/dashboard/analytics/components/revenue-by-tier-chart.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  StackId,
} from 'recharts';
import { useRevenueData } from '../hooks/use-revenue-data';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';

interface RevenueByTierChartProps {
  userTier: string;
}

export function RevenueByTierChart({ userTier }: RevenueByTierChartProps) {
  const t = useTranslations('dashboard.analytics.revenue');
  const { metrics, isLoading } = useRevenueData('monthly');

  const isPremium = userTier === 'PREMIUM' || userTier === 'ENTERPRISE' || userTier === 'MASTER';

  if (!isPremium) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{t('by_tier')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg gap-4">
            <Lock className="h-8 w-8" />
            <div className="text-center">
              <p className="font-semibold">{t('premium_feature')}</p>
              <p className="text-sm">{t('upgrade_message')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-[350px] rounded-xl" />;
  }

  // Aggregate revenue by tier by month
  const chartData = aggregateByTier(metrics);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{t('by_tier')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
              <Bar
                dataKey="BASIC"
                name="Starter"
                stackId="a"
                fill="#3b82f6"
              />
              <Bar
                dataKey="PREMIUM"
                name="Growth"
                stackId="a"
                fill="#10b981"
              />
              <Bar
                dataKey="ENTERPRISE"
                name="Premium"
                stackId="a"
                fill="#f59e0b"
              />
              <Bar
                dataKey="MASTER"
                name="Master"
                stackId="a"
                fill="#8b5cf6"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function aggregateByTier(metrics: any[]) {
  const byMonth = new Map<string, any>();

  metrics.forEach(m => {
    const month = new Date(m.periodStart).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });

    if (!byMonth.has(month)) {
      byMonth.set(month, { month, BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0 });
    }

    const data = byMonth.get(month);
    data[m.tier] += Number(m.grossRevenue);
  });

  return Array.from(byMonth.values());
}
```

### Step 2: Create Cohort Retention Heatmap

```typescript
// src/app/[locale]/dashboard/analytics/components/cohort-heatmap.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { useCohortData } from '../hooks/use-cohort-data';

interface CohortHeatmapProps {
  userTier: string;
}

export function CohortHeatmap({ userTier }: CohortHeatmapProps) {
  const t = useTranslations('dashboard.analytics.cohorts');
  const isPremium = userTier === 'PREMIUM' || userTier === 'ENTERPRISE' || userTier === 'MASTER';

  const { data, isLoading } = useCohortData();

  if (!isPremium) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{t('retention')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg gap-4">
            <Lock className="h-8 w-8" />
            <div className="text-center">
              <p className="font-semibold">{t('premium_feature')}</p>
              <p className="text-sm">{t('upgrade_message')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{t('retention')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            {t('loading')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{t('retention')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">{t('cohort')}</th>
                {data.periods.map((p: number) => (
                  <th key={p} className="p-2 text-center">M{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort: any) => (
                <tr key={cohort.month} className="border-b">
                  <td className="p-2 font-medium">{cohort.month}</td>
                  {cohort.retention.map((rate: number, idx: number) => (
                    <td
                      key={idx}
                      className="p-2 text-center"
                      style={{
                        backgroundColor: getRetentionColor(rate),
                        color: rate > 50 ? 'white' : 'black',
                      }}
                    >
                      {rate.toFixed(0)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function getRetentionColor(rate: number): string {
  if (rate >= 80) return '#10b981'; // Green
  if (rate >= 60) return '#84cc16'; // Light green
  if (rate >= 40) return '#f59e0b'; // Yellow
  if (rate >= 20) return '#f97316'; // Orange
  return '#ef4444'; // Red
}
```

### Step 3: Create Chart Export Service

```typescript
// src/lib/analytics/chart-export-service.ts

export const chartExportService = {
  /**
   * Export chart as PNG
   */
  async exportChartAsPNG(
    chartId: string,
    filename: string = 'chart'
  ): Promise<void> {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) {
      console.error('Chart element not found');
      return;
    }

    // Use html2canvas or similar library
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(chartElement);

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  },

  /**
   * Export chart data as CSV
   */
  exportDataAsCSV(data: any[], filename: string = 'data'): void {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => JSON.stringify(row[header])).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Export chart as PDF (using jspdf)
   */
  async exportChartAsPDF(
    chartId: string,
    filename: string = 'chart',
    title: string = ''
  ): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const chartElement = document.getElementById(chartId);
    if (!chartElement) return;

    const canvas = await html2canvas(chartElement);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, 10, 10);
    }

    pdf.addImage(imgData, 'PNG', 10, 20, 277, 150);
    pdf.save(`${filename}.pdf`);
  }
};
```

### Step 4: Add Export Buttons to Charts

```typescript
// Add to existing chart components

import { Download } from 'lucide-react';
import { chartExportService } from '@/lib/analytics/chart-export-service';

// In chart component
<div className="flex justify-between items-center mb-4">
  <CardTitle>Revenue Trends</CardTitle>
  <Button
    variant="outline"
    size="sm"
    onClick={() => chartExportService.exportChartAsPNG('revenue-chart', 'revenue-trends')}
  >
    <Download className="h-4 w-4 mr-2" />
    Export
  </Button>
</div>

<div id="revenue-chart">
  {/* Chart content */}
</div>
```

### Step 5: Update Analytics View with Premium Charts

```typescript
// src/app/[locale]/dashboard/analytics/components/analytics-view.tsx

import { RevenueByTierChart } from './revenue-by-tier-chart';
import { CohortHeatmap } from './cohort-heatmap';

export function AnalyticsView({ campaigns, userTier }: AnalyticsViewProps) {
  const isPremium = userTier !== 'BASIC';

  return (
    <div className="space-y-8">
      {/* ... existing sections ... */}

      {/* Premium Visualizations */}
      {isPremium && (
        <>
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">
              {t('premium_visualizations')}
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <RevenueByTierChart userTier={userTier} />
              <CohortHeatmap userTier={userTier} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
```

## Success Criteria

- [ ] Revenue by tier chart shows stacked bars
- [ ] Cohort heatmap displays retention rates
- [ ] Export buttons work (PNG, CSV, PDF)
- [ ] Premium gating hides charts for BASIC users
- [ ] Charts responsive on all screen sizes

## Premium Features Matrix

| Feature | BASIC | PREMIUM | ENTERPRISE | MASTER |
|---------|-------|---------|------------|--------|
| Revenue metrics | ✓ | ✓ | ✓ | ✓ |
| ROI gauge | ✓ | ✓ | ✓ | ✓ |
| Revenue by tier chart | ✗ | ✓ | ✓ | ✓ |
| Cohort heatmap | ✗ | ✓ | ✓ | ✓ |
| Export (PNG/CSV/PDF) | ✗ | ✓ | ✓ | ✓ |
| Custom projections | ✗ | ✓ | ✓ | ✓ |

## Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.1"
  }
}
```

## Risks

- **Risk**: Export libraries increase bundle size
- **Mitigation**: Lazy load export functions only when used

## Next Steps

After premium visualizations:
1. Full integration testing across all phases
2. Performance optimization
3. Documentation updates
4. Production deployment
