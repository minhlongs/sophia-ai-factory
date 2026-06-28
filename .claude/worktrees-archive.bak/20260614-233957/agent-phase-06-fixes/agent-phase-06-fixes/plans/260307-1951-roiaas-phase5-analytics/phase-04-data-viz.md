---
title: "Phase 04 — Data Visualizations with Recharts"
description: "Enhanced charts với Recharts: area, bar, line cho time-series data"
status: pending
priority: P2
effort: 1.5h
---

# Phase 04 — Data Visualizations with Recharts

**Context:**
- Existing charts: `src/components/analytics/usage-chart.tsx`, `service-breakdown.tsx`, `license-utilization.tsx`
- Existing: `src/app/[locale]/dashboard/analytics/components/charts.tsx`
- Library: Recharts (already installed)

---

## Overview

Nâng cấp data visualizations với Recharts: area charts cho time-series, bar charts cho comparisons, pie charts cho distributions. Thêm export functionality (CSV/PNG).

---

## Key Insights

1. **Charts đã tồn tại** — `UsageChart`, `ServiceBreakdownChart`, `LicenseUtilizationChart` đã implement
2. **Recharts stable** — Đang dùng PieChart, BarChart
3. **Missing:**
   - AreaChart cho time-series (smooth gradients)
   - Custom tooltips với formatted data
   - Chart export to PNG
   - Responsive sizing optimization

---

## Requirements

### Functional

1. **Area Chart cho Time-Series**
   - Usage over time (requests, credits, tokens)
   - Revenue trend over time
   - Gradient fills cho visual polish

2. **Bar Chart cho Comparisons**
   - Tier breakdown (revenue by tier)
   - Service breakdown (requests by service)
   - License utilization (by tier)

3. **Pie/Donut Chart cho Distributions**
   - Tier distribution
   - Service usage distribution
   - Revenue sources

4. **Export Functionality**
   - CSV export (đã có — `/api/analytics/export`)
   - PNG export (chart screenshots)

5. **Responsive Design**
   - Mobile-first layouts
   - Touch-friendly interactions
   - Dark mode support

### Non-Functional

- Chart render time < 200ms
- Smooth animations (300ms duration)
- Accessible (keyboard navigation, screen reader support)

---

## Related Code Files

**Modify:**
- `src/components/analytics/usage-chart.tsx` — Add AreaChart option
- `src/components/analytics/service-breakdown.tsx` — Enhance với bar chart option
- `src/components/analytics/license-utilization.tsx` — Add horizontal bar chart
- `src/app/[locale]/dashboard/analytics/components/charts.tsx` — Consolidate chart components

**Create:**
- `src/components/analytics/chart-tooltip.tsx` — Custom tooltip component
- `src/lib/analytics/chart-export.ts` — PNG export helpers

---

## Implementation Steps

### Step 1: Enhanced Usage Chart với AreaChart

File: `src/components/analytics/usage-chart.tsx`

```typescript
'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMemo } from 'react';

export type UsageMetric = 'requests' | 'credits' | 'tokens';

interface TimeSeriesPoint {
  timestamp: number;
  requests: number;
  credits: number;
  tokens: number;
  errors: number;
}

interface UsageChartProps {
  data: TimeSeriesPoint[] | null;
  metric: UsageMetric;
  granularity: 'hour' | 'day';
  loading: boolean;
  title?: string;
}

export function UsageChart({ data, metric, granularity, loading, title }: UsageChartProps) {
  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return granularity === 'hour'
      ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format value based on metric
  const formatValue = (value: number) => {
    if (metric === 'requests') return value.toLocaleString();
    if (metric === 'credits') return value.toLocaleString();
    if (metric === 'tokens') return (value / 1000).toFixed(1) + 'k';
    return value.toString();
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-1">{label}</p>
          <p className="text-lg font-bold text-primary">
            {formatValue(payload[0].value)} {metric}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading || !data || data.length === 0) {
    return (
      <div className="h-[300px] bg-muted rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-muted-foreground">Loading chart...</span>
      </div>
    );
  }

  const gradientId = `gradient-${metric}`;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="hsl(var(--primary))"
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Step 2: Enhanced Service Breakdown với BarChart

File: `src/components/analytics/service-breakdown.tsx`

```typescript
'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ServiceBreakdownData {
  service: string;
  requests: number;
  credits: number;
  percentage: number;
}

interface ServiceBreakdownChartProps {
  data: ServiceBreakdownData[] | null;
  loading: boolean;
  title?: string;
  variant?: 'pie' | 'bar';
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function ServiceBreakdownChart({
  data,
  loading,
  title,
  variant = 'pie',
}: ServiceBreakdownChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title || 'Service Breakdown'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const datum = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-1">{datum.service}</p>
          <p className="text-primary font-bold">{datum.requests.toLocaleString()} requests</p>
          <p className="text-xs text-muted-foreground">
            {datum.credits.toLocaleString()} credits ({datum.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || 'Service Breakdown'}</CardTitle>
      </CardHeader>
      <CardContent>
        {variant === 'pie' ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                dataKey="requests"
                nameKey="service"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ service, percentage }) => `${service}: ${percentage.toFixed(1)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.service} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="service"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="requests" fill="hsl(var(--primary))">
                {data.map((entry, index) => (
                  <Cell key={entry.service} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 3: PNG Export Functionality

File: `src/lib/analytics/chart-export.ts`

```typescript
/**
 * Chart Export Utilities
 *
 * Export charts to PNG format
 */

/**
 * Export Recharts chart to PNG
 *
 * @param chartId - DOM element ID of the chart container
 * @param filename - Output filename (without extension)
 */
export async function exportChartToPng(
  chartId: string,
  filename: string = 'chart'
): Promise<void> {
  const element = document.getElementById(chartId);
  if (!element) {
    throw new Error(`Chart element #${chartId} not found`);
  }

  // Use html2canvas for screenshot
  const html2canvas = (await import('html2canvas')).default;

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2, // Retina quality
    logging: false,
    useCORS: true,
  });

  // Download PNG
  const link = document.createElement('a');
  link.download = `${filename}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Export all charts on page to ZIP
 */
export async function exportAllChartsToZip(): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Find all chart containers
  const charts = document.querySelectorAll('[data-chart-id]');
  const promises = Array.from(charts).map(async (chart) => {
    const chartId = chart.getAttribute('data-chart-id');
    if (!chartId) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chart as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      zip.file(`chart-${chartId}.png`, blob);
    } catch (error) {
      console.error(`Failed to export chart ${chartId}:`, error);
    }
  });

  await Promise.all(promises);

  // Download ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.download = `analytics-charts-${Date.now()}.zip`;
  link.href = URL.createObjectURL(content);
  link.click();
  URL.revokeObjectURL(link.href);
}
```

### Step 4: Add Dependencies

```bash
# Install export dependencies
npm install html2canvas jszip
```

### Step 5: Enhanced Export Button

File: `src/components/analytics/export-button.tsx` (modify existing)

```typescript
import { Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportButtonProps {
  disabled: boolean;
  loading: boolean;
  dateRange: { from: Date; to?: Date };
  upgradeHint?: string;
}

export function ExportButton({
  disabled,
  loading,
  dateRange,
  upgradeHint,
}: ExportButtonProps) {
  const handleExport = async (format: 'csv' | 'png' | 'zip') => {
    if (format === 'csv') {
      // Existing CSV export logic
      const res = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, format: 'csv' }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${start}-${end}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'png') {
      // PNG export for currently visible chart
      const { exportChartToPng } = await import('@/lib/analytics/chart-export');
      await exportChartToPng('active-chart', `analytics-${Date.now()}`);
    } else {
      // ZIP all charts
      const { exportAllChartsToZip } = await import('@/lib/analytics/chart-export');
      await exportAllChartsToZip();
    }
  };

  if (disabled) {
    return (
      <Button disabled title={upgradeHint}>
        <Download className="w-4 h-4" />
        Export
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={loading}>
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('png')}>
          PNG (Current Chart)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('zip')}>
          ZIP (All Charts)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Todo Checklist

- [ ] Enhance `usage-chart.tsx` với AreaChart
- [ ] Enhance `service-breakdown.tsx` với bar chart option
- [ ] Create `chart-tooltip.tsx` custom tooltip
- [ ] Create `chart-export.ts` PNG export helpers
- [ ] Install dependencies: `html2canvas`, `jszip`
- [ ] Enhance `export-button.tsx` với PNG/ZIP options
- [ ] Test export functionality trên browsers

---

## Success Criteria

- [ ] AreaChart renders smoothly với gradient fills
- [ ] BarChart displays service breakdown clearly
- [ ] PieChart shows tier distribution
- [ ] PNG export works trên Chrome, Safari, Firefox
- [ ] ZIP export downloads all charts
- [ ] Charts responsive trên mobile

---

## Accessibility Considerations

1. **Keyboard Navigation:** Tab through chart data points
2. **Screen Readers:** ARIA labels cho chart data
3. **Color Contrast:** Ensure colors meet WCAG AA
4. **Focus States:** Visible focus rings on interactive elements

---

## Next Steps

→ Phase 05: Premium tier gating implementation
