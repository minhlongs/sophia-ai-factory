'use client';

/**
 * ErrorRateChart Component
 *
 * Displays error trends over time using Recharts.
 * Shows error count and error rate percentage.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TimeSeriesPoint } from '@/land/analytics/types';
import {
  formatErrorRateTimestamp,
  calculateErrorRate,
  ErrorRateCustomTooltip,
  type ErrorRateCustomTooltipProps,
} from './error-rate-chart-tooltip';

export {
  formatErrorRateTimestamp,
  calculateErrorRate,
  ErrorRateCustomTooltip,
  type ErrorRateCustomTooltipProps,
};

interface ErrorRateChartProps {
  data: TimeSeriesPoint[];
  granularity: 'hour' | 'day';
  height?: number;
}

export function ErrorRateChart({
  data,
  granularity,
  height = 250,
}: ErrorRateChartProps) {
  const formatTimestamp = (timestamp: number) =>
    formatErrorRateTimestamp(timestamp, granularity);

  const enhancedData = data.map((point) => ({
    ...point,
    errorRate: calculateErrorRate(point),
  }));

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No error data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={enhancedData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            label={{ value: 'Error Rate %', angle: 90, position: 'insideRight' }}
            domain={[0, 100]}
          />
          <Tooltip content={<ErrorRateCustomTooltip />} />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="errors"
            name="Errors"
            fill="var(--neon-red, #ef4444)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="errorRate"
            name="Error Rate %"
            fill="var(--neon-orange, #f97316)"
            radius={[4, 4, 0, 0]}
          />
          <ReferenceLine
            yAxisId="right"
            y={5}
            stroke="var(--neon-yellow, #eab308)"
            strokeDasharray="3 3"
            label={{ value: 'Warning (5%)', position: 'right', fill: 'var(--neon-yellow, #eab308)', fontSize: 10 }}
          />
          <ReferenceLine
            yAxisId="right"
            y={10}
            stroke="var(--neon-red, #ef4444)"
            strokeDasharray="3 3"
            label={{ value: 'Critical (10%)', position: 'right', fill: 'var(--neon-red, #ef4444)', fontSize: 10 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
