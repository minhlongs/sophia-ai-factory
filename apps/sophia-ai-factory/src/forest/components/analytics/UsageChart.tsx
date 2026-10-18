'use client';

/**
 * UsageChart Component
 *
 * Displays API calls over time using Recharts line chart.
 * Shows requests and credits trends with customizable granularity.
 */

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { TimeSeriesPoint } from '@/land/analytics/types';
import {
  formatChartTimestamp,
  formatChartNumber,
  UsageChartTooltip,
} from './usage-chart-tooltip';

interface UsageChartProps {
  data: TimeSeriesPoint[];
  granularity: 'hour' | 'day';
  showCredits?: boolean;
  showTokens?: boolean;
  height?: number;
}

export function UsageChart({
  data,
  granularity,
  showCredits = true,
  height = 300,
}: UsageChartProps) {
  const formatTimestamp = (timestamp: number) =>
    formatChartTimestamp(timestamp, granularity);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No usage data available</p>
          <p className="text-xs mt-1">Select a different time range to view data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--neon-cyan)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--neon-cyan)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--neon-purple)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--neon-purple)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatChartNumber}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatChartNumber}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip content={<UsageChartTooltip />} />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="requests"
            name="API Requests"
            stroke="var(--neon-cyan)"
            fill="url(#colorRequests)"
            strokeWidth={2}
          />
          {showCredits && (
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="credits"
              name="Credits"
              stroke="var(--neon-purple)"
              fill="url(#colorCredits)"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
